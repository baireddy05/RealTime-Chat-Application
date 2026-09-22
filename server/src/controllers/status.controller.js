import Status from "../models/Status.model.js";
import User from "../models/User.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const uploadStatus = async (req, res) => {
  try {
    const { text, bg, mediaUrl, mediaType } = req.body;
    const userId = req.user._id;

    if (!text && !mediaUrl) {
      return res.status(400).json({ error: "Status text or media is required" });
    }
    if (mediaUrl && !["image", "video"].includes(mediaType)) {
      return res.status(400).json({ error: "mediaType must be image or video" });
    }
    if (mediaUrl && (typeof mediaUrl !== "string" || !mediaUrl.startsWith("http"))) {
      return res.status(400).json({ error: "Invalid media URL" });
    }

    // Status expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newStatus = new Status({
      userId,
      text: text || "",
      bg: bg || "bg-gradient-to-tr from-sky-500 to-indigo-600",
      mediaUrl: mediaUrl || null,
      mediaType: mediaUrl ? mediaType : null,
      expiresAt,
    });

    await newStatus.save();
    
    // Populate user details before emitting
    await newStatus.populate("userId", "username profilePic");

    // Emit to all friends
    const currentUser = await User.findById(userId).select("friends");
    if (currentUser && currentUser.friends) {
      currentUser.friends.forEach((friendId) => {
        io.to(friendId.toString()).emit("newStatus", newStatus);
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
    const allowedUserIds = [userId, ...(currentUser?.friends || [])];

    const statuses = await Status.find({
      userId: { $in: allowedUserIds },
    })
      .populate("userId", "username profilePic")
      .sort({ createdAt: -1 });

    res.status(200).json(statuses);
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
        io.to(friendId.toString()).emit("deletedStatus", { statusId, userId });
      });
    }

    res.status(200).json({ success: true, message: "Status deleted successfully", statusId });
  } catch (error) {
    console.error("Error in deleteStatus controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Record a view (idempotent). Owners viewing their own story don't count.
export const viewStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user._id;

    const status = await Status.findById(statusId).select("userId viewers");
    if (!status) return res.status(404).json({ error: "Status not found" });
    if (status.userId.toString() === userId.toString()) {
      return res.status(200).json({ success: true, viewersCount: (status.viewers || []).length });
    }

    await Status.updateOne(
      { _id: statusId, "viewers.userId": { $ne: userId } },
      { $push: { viewers: { userId, at: new Date() } } }
    );
    const updated = await Status.findById(statusId).select("viewers").lean();
    res.status(200).json({ success: true, viewersCount: (updated?.viewers || []).length });
  } catch (error) {
    console.error("Error in viewStatus controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Owner-only: who viewed this story
export const getStatusViewers = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user._id;

    const status = await Status.findById(statusId)
      .select("userId viewers")
      .populate("viewers.userId", "username profilePic")
      .lean();
    if (!status) return res.status(404).json({ error: "Status not found" });
    if (status.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Only the owner can see viewers" });
    }

    res.status(200).json(
      (status.viewers || []).map((v) => ({
        _id: v.userId?._id || v.userId,
        username: v.userId?.username || "User",
        profilePic: v.userId?.profilePic || "",
        at: v.at,
      }))
    );
  } catch (error) {
    console.error("Error in getStatusViewers controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
