import Status from "../models/Status.model.js";
import User from "../models/User.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { isSafeUrl } from "../controllers/chat.controller.js";

// Backgrounds are a closed allow-list: arbitrary class strings would allow
// UI injection into every friend's story viewer.
const ALLOWED_STATUS_BGS = new Set([
  "bg-gradient-to-tr from-sky-500 to-indigo-600",
  "bg-gradient-to-tr from-emerald-500 to-teal-600",
  "bg-gradient-to-tr from-amber-500 to-rose-600",
  "bg-gradient-to-tr from-violet-500 to-purple-600",
  "bg-gradient-to-tr from-slate-700 to-slate-900",
  "bg-gradient-to-tr from-cyan-500 to-blue-600",
  "bg-gradient-to-tr from-fuchsia-500 to-pink-600",
  "bg-gradient-to-tr from-lime-500 to-emerald-600",
]);

export const uploadStatus = async (req, res) => {
  try {
    const { text, bg, mediaUrl, mediaType } = req.body;
    const userId = req.user._id;

    if ((!text || !String(text).trim()) && !mediaUrl) {
      return res.status(400).json({ error: "Status text or media is required" });
    }
    if (typeof text === "string" && text.length > 500) {
      return res.status(400).json({ error: "Status text too long (max 500 chars)" });
    }
    if (bg !== undefined && (typeof bg !== "string" || !ALLOWED_STATUS_BGS.has(bg))) {
      return res.status(400).json({ error: "Invalid status background" });
    }
    if (mediaUrl && !["image", "video"].includes(mediaType)) {
      return res.status(400).json({ error: "mediaType must be image or video" });
    }
    if (mediaUrl && (typeof mediaUrl !== "string" || mediaUrl.length > 2048 || !isSafeUrl(mediaUrl))) {
      return res.status(400).json({ error: "Invalid media URL" });
    }

    // Status expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newStatus = new Status({
      userId,
      text: typeof text === "string" ? text.slice(0, 500) : "",
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
    const me = await User.findById(userId).select("friends blockedUsers").lean();
    const allowedUserIds = [userId, ...((me?.friends) || [])];

    const statuses = await Status.find({
      userId: { $in: allowedUserIds },
    })
      .populate("userId", "username profilePic")
      .sort({ createdAt: -1 });

    // Never show stories from blocked contacts (either direction).
    const hidden = new Set(((me?.blockedUsers) || []).map((id) => id.toString()));
    const blockers = await User.find({ blockedUsers: userId }).select("_id").lean();
    blockers.forEach((u) => hidden.add(u._id.toString()));
    const visible = statuses.filter((s) => {
      const owner = (s.userId?._id || s.userId)?.toString();
      return owner === userId.toString() || !hidden.has(owner);
    });

    res.status(200).json(visible);
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
// Only friends (or self) may view: strangers can't enumerate stories or
// inflate viewer counts, and blocked pairs are excluded both ways.
export const viewStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user._id;

    const status = await Status.findById(statusId).select("userId viewers");
    if (!status) return res.status(404).json({ error: "Status not found" });
    if (status.userId.toString() === userId.toString()) {
      return res.status(200).json({ success: true, viewersCount: (status.viewers || []).length });
    }

    const owner = await User.findById(status.userId).select("friends blockedUsers").lean();
    const isFriend = (owner?.friends || []).some((f) => f.toString() === userId.toString());
    if (!isFriend) {
      return res.status(403).json({ error: "Not allowed to view this story" });
    }
    const blocked = (owner?.blockedUsers || []).some((b) => b.toString() === userId.toString());
    const iBlocked = await User.findOne({ _id: userId, blockedUsers: status.userId }).select("_id").lean();
    if (blocked || iBlocked) {
      return res.status(403).json({ error: "Not allowed to view this story" });
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
