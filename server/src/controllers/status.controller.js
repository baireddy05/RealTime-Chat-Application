import Status from "../models/Status.model.js";
import User from "../models/User.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const uploadStatus = async (req, res) => {
  try {
    const { text, bg } = req.body;
    const userId = req.user._id;

    if (!text) {
      return res.status(400).json({ error: "Status text is required" });
    }

    // Status expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newStatus = new Status({
      userId,
      text,
      bg: bg || "bg-gradient-to-tr from-sky-500 to-indigo-600",
      expiresAt,
    });

    await newStatus.save();
    
    // Populate user details before emitting
    await newStatus.populate("userId", "username profilePic");

    // Emit to all friends
    const currentUser = await User.findById(userId).select("friends");
    if (currentUser && currentUser.friends) {
      currentUser.friends.forEach((friendId) => {
        const friendSocketId = getReceiverSocketId(friendId.toString());
        if (friendSocketId) {
          io.to(friendSocketId).emit("newStatus", newStatus);
        }
      });
    }

    res.status(201).json(newStatus);
  } catch (error) {
    console.error("Error in uploadStatus controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getStatuses = async (req, res) => {
  try {
    const userId = req.user._id;

    const currentUser = await User.findById(userId).select("friends");
    const friendIds = currentUser.friends || [];

    // Also fetch own active statuses
    const targetIds = [...friendIds, userId];

    const activeStatuses = await Status.find({
      userId: { $in: targetIds },
      expiresAt: { $gt: new Date() },
    })
      .populate("userId", "username profilePic")
      .sort({ createdAt: 1 })
      .lean();

    res.status(200).json(activeStatuses);
  } catch (error) {
    console.error("Error in getStatuses controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user._id;

    const status = await Status.findById(statusId);
    
    if (!status) {
      return res.status(404).json({ error: "Status not found" });
    }

    if (status.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Unauthorized to delete this status" });
    }

    await Status.findByIdAndDelete(statusId);

    // Notify friends about the deleted status so it disappears immediately
    const currentUser = await User.findById(userId).select("friends");
    if (currentUser && currentUser.friends) {
      currentUser.friends.forEach((friendId) => {
        const friendSocketId = getReceiverSocketId(friendId.toString());
        if (friendSocketId) {
          io.to(friendSocketId).emit("deletedStatus", { statusId, userId });
        }
      });
    }

    res.status(200).json({ success: true, message: "Status deleted successfully", statusId });
  } catch (error) {
    console.error("Error in deleteStatus controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
