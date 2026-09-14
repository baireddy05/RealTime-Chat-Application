import User from "../models/User.model.js";
import FriendRequest from "../models/FriendRequest.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

// Get logged in user's friends
export const getFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("friends", "username email profilePic status bio")
      .lean();
    // Deduplicate friends (in case of legacy duplicates in the array)
    const seen = new Set();
    const uniqueFriends = (user?.friends || []).filter((f) => {
      const id = f._id.toString();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    res.status(200).json(uniqueFriends);
  } catch (error) {
    console.error("Error in getFriends controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get pending incoming and outgoing friend requests
export const getFriendRequests = async (req, res) => {
  try {
    const userId = req.user._id;

    const incoming = await FriendRequest.find({
      receiver: userId,
      status: "pending",
    })
      .populate("sender", "username email profilePic status bio")
      .lean();

    const outgoing = await FriendRequest.find({
      sender: userId,
      status: "pending",
    })
      .populate("receiver", "username email profilePic status bio")
      .lean();

    res.status(200).json({ incoming, outgoing });
  } catch (error) {
    console.error("Error in getFriendRequests controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search users with relationship status
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const currentUserId = req.user._id;

    if (!query || query.trim().length === 0) {
      return res.status(200).json([]);
    }

    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escapedQuery, "i");
    const foundUsers = await User.find({
      _id: { $ne: currentUserId },
      $or: [{ username: searchRegex }, { email: searchRegex }],
    })
      .select("username email profilePic status bio friends")
      .limit(15)
      .lean();

    const currentUser = await User.findById(currentUserId).select("friends").lean();
    const existingRequests = await FriendRequest.find({
      $or: [
        { sender: currentUserId, receiver: { $in: foundUsers.map((u) => u._id) } },
        { receiver: currentUserId, sender: { $in: foundUsers.map((u) => u._id) } },
      ],
      status: "pending",
    }).lean();

    const results = foundUsers.map((user) => {
      let relationship = "none";
      const isFriend = currentUser.friends.some((f) => f.toString() === user._id.toString());

      if (isFriend) {
        relationship = "friend";
      } else {
        const reqOut = existingRequests.find(
          (r) => r.sender.toString() === currentUserId.toString() && r.receiver.toString() === user._id.toString()
        );
        const reqIn = existingRequests.find(
          (r) => r.receiver.toString() === currentUserId.toString() && r.sender.toString() === user._id.toString()
        );

        if (reqOut) relationship = "pending_outgoing";
        else if (reqIn) relationship = "pending_incoming";
      }

      return {
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        status: user.status,
        bio: user.bio,
        relationship,
      };
    });

    res.status(200).json(results);
  } catch (error) {
    console.error("Error in searchUsers controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Send a friend request
export const sendFriendRequest = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { targetUserId } = req.params;

    if (senderId.toString() === targetUserId) {
      return res.status(400).json({ message: "You cannot send a friend request to yourself" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if already friends
    const currentUser = await User.findById(senderId);
    if (currentUser.friends.some((f) => f.toString() === targetUserId)) {
      return res.status(400).json({ message: "You are already friends with this user" });
    }

    // Check if pending request exists in either direction
    const existingReq = await FriendRequest.findOne({
      $or: [
        { sender: senderId, receiver: targetUserId, status: "pending" },
        { sender: targetUserId, receiver: senderId, status: "pending" },
      ],
    });

    if (existingReq) {
      return res.status(400).json({ message: "A friend request is already pending between you" });
    }

    const newRequest = await FriendRequest.create({
      sender: senderId,
      receiver: targetUserId,
      status: "pending",
    });

    await newRequest.populate("sender", "username email profilePic status bio");

    // Real-time socket notification to receiver
    const receiverSocketId = getReceiverSocketId(targetUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newFriendRequest", newRequest);
    }

    res.status(201).json(newRequest);
  } catch (error) {
    console.error("Error in sendFriendRequest controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Accept a friend request
export const acceptFriendRequest = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { requestId } = req.params;

    const friendRequest = await FriendRequest.findById(requestId);
    if (!friendRequest) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    if (friendRequest.receiver.toString() !== currentUserId.toString()) {
      return res.status(403).json({ message: "You are not authorized to accept this request" });
    }

    friendRequest.status = "accepted";
    await friendRequest.save();

    // Link both users as friends
    await User.findByIdAndUpdate(currentUserId, { $addToSet: { friends: friendRequest.sender } });
    await User.findByIdAndUpdate(friendRequest.sender, { $addToSet: { friends: currentUserId } });

    const updatedSender = await User.findById(friendRequest.sender).select("username email profilePic status bio");
    const updatedReceiver = await User.findById(currentUserId).select("username email profilePic status bio");

    // Real-time socket notification to sender
    const senderSocketId = getReceiverSocketId(friendRequest.sender.toString());

    // Only notify the original sender — the acceptor (receiver) already
    // updates their own state from the HTTP response, so emitting to them
    // would cause a duplicate friend entry.
    if (senderSocketId) {
      io.to(senderSocketId).emit("friendRequestAccepted", {
        newFriend: updatedReceiver,
        requestId,
      });
    }

    res.status(200).json({ message: "Friend request accepted", friend: updatedSender });
  } catch (error) {
    console.error("Error in acceptFriendRequest controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Reject a friend request
export const rejectFriendRequest = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { requestId } = req.params;

    const friendRequest = await FriendRequest.findById(requestId);
    if (!friendRequest) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    if (
      friendRequest.receiver.toString() !== currentUserId.toString() &&
      friendRequest.sender.toString() !== currentUserId.toString()
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await FriendRequest.findByIdAndDelete(requestId);

    res.status(200).json({ message: "Friend request cancelled/rejected" });
  } catch (error) {
    console.error("Error in rejectFriendRequest controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Remove a friend
export const removeFriend = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { userId } = req.params;

    await User.findByIdAndUpdate(currentUserId, { $pull: { friends: userId } });
    await User.findByIdAndUpdate(userId, { $pull: { friends: currentUserId } });

    // Clean up any accepted request documents
    await FriendRequest.deleteMany({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
    });

    const targetSocketId = getReceiverSocketId(userId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("friendRemoved", { userId: currentUserId });
    }

    res.status(200).json({ message: "Friend removed successfully" });
  } catch (error) {
    console.error("Error in removeFriend controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
