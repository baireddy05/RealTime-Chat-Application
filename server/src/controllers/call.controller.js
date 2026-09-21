import CallLog from "../models/CallLog.model.js";

export const getCallHistory = async (req, res) => {
  try {
    const myId = req.user._id;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const logs = await CallLog.find({
      $or: [{ callerId: myId }, { receiverId: myId }],
      hiddenFor: { $ne: myId },
    })
      .populate("callerId", "username profilePic")
      .populate("receiverId", "username profilePic")
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();
    res.status(200).json(logs);
  } catch (error) {
    console.error("Error in getCallHistory:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const clearCallHistory = async (req, res) => {
  try {
    const myId = req.user._id;
    // Per-user clear: hides my side of every log I participate in.
    // The other party keeps their own copy until they clear it too.
    await CallLog.updateMany(
      { $or: [{ callerId: myId }, { receiverId: myId }] },
      { $addToSet: { hiddenFor: myId } }
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in clearCallHistory:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};