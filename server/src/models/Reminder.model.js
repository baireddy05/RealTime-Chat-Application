import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: true,
    },
    remindAt: {
      type: Date,
      required: true,
    },
    note: {
      type: String,
      default: "",
    },
    isSent: {
      type: Boolean,
      default: false,
    },
    sentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

reminderSchema.index({ isSent: 1, remindAt: 1 });
reminderSchema.index({ userId: 1, isSent: 1 });

const Reminder = mongoose.model("Reminder", reminderSchema);

export default Reminder;
