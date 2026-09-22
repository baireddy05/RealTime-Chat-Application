import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    profilePic: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "Hey there! I am using RealTime Chat.",
    },
    status: {
      type: String,
      default: "Available",
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    readReceipts: {
      type: Boolean,
      default: true,
    },
    chatPreferences: {
      type: Map,
      of: new mongoose.Schema({
        wallpaper: String,
        theme: String,
        archived: Boolean,
        disappearing: Number,
        tone: String,
      }, { _id: false }),
      default: {},
    },
    labels: [
      {
        name: { type: String, required: true, trim: true, maxlength: 30 },
        color: { type: String, default: "#6366f1", maxlength: 20 },
      },
    ],
    chatLabels: {
      type: Map,
      of: [String],
      default: {},
    },
    pinnedChats: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// Multikey index for O(log N) friend lookups and membership checks
userSchema.index({ friends: 1 });
userSchema.index({ blockedUsers: 1 });

const User = mongoose.model("User", userSchema);

export default User;
