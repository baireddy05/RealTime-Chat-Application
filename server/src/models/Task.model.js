import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    description: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    // Exactly one of roomId / receiverId identifies the conversation context.
    // receiverId is the *other* participant from the creator's perspective.
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    dueAt: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    isDone: {
      type: Boolean,
      default: false,
    },
    doneAt: {
      type: Date,
      default: null,
    },
    sourceMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
  },
  { timestamps: true }
);

taskSchema.index({ roomId: 1, isDone: 1, createdAt: -1 });
taskSchema.index({ receiverId: 1, createdBy: 1, isDone: 1 });
taskSchema.index({ assignees: 1, isDone: 1 });

const Task = mongoose.model("Task", taskSchema);

export default Task;
