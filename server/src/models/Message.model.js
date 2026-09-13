import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
    audio: {
      type: String,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    reactions: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        username: String,
        emoji: {
          type: String,
          required: true,
        },
      },
    ],
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    replyTo: {
      messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
      senderName: String,
      text: String,
      image: String,
      file: Object,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    isForwarded: {
      type: Boolean,
      default: false,
    },
    file: {
      url: String,
      name: String,
      size: Number,
      fileType: String,
    },
    starredBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    expiresAt: {
      type: Date,
      default: null,
    },
    scheduledFor: {
      type: Date,
      default: null,
    },
    isScheduled: {
      type: Boolean,
      default: false,
    },
    linkPreview: {
      url: String,
      title: String,
      description: String,
      image: String,
      siteName: String,
    },
    parentMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    threadCount: {
      type: Number,
      default: 0,
    },
    threadLastReply: {
      type: Date,
      default: null,
    },
    isAiResponse: {
      type: Boolean,
      default: false,
    },
    isEncrypted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound indexes for fast B-Tree lookups (O(log N) instead of O(N) COLLSCAN)
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: 1 });
messageSchema.index({ roomId: 1, createdAt: 1 });
messageSchema.index({ roomId: 1, isScheduled: 1, parentMessageId: 1 });
messageSchema.index({ parentMessageId: 1, createdAt: 1 });
messageSchema.index({ isScheduled: 1, scheduledFor: 1 });
messageSchema.index({ starredBy: 1 });
messageSchema.index({ expiresAt: 1, isDeleted: 1 });
// Native MongoDB TTL index to automatically purge expired disappearing messages
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

const Message = mongoose.model("Message", messageSchema);

export default Message;
