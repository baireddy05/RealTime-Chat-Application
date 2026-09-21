import mongoose from "mongoose";

const callLogSchema = new mongoose.Schema(
  {
    callerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    callType: {
      type: String,
      enum: ["audio", "video"],
      default: "video",
    },
    status: {
      type: String,
      enum: ["missed", "rejected", "completed", "cancelled"],
      default: "missed",
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    answeredAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    durationSec: {
      type: Number,
      default: 0,
    },
    hiddenFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

callLogSchema.index({ callerId: 1, startedAt: -1 });
callLogSchema.index({ receiverId: 1, startedAt: -1 });

const CallLog = mongoose.model("CallLog", callLogSchema);

export default CallLog;
