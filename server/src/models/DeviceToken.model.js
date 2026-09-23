import mongoose from "mongoose";

// Device push tokens (FCM registration tokens reported by native or web
// clients). One per device.
const deviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    platform: {
      type: String,
      enum: ["android", "ios", "web"],
      default: "android",
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    appVersion: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

deviceTokenSchema.index({ userId: 1 });

const DeviceToken = mongoose.model("DeviceToken", deviceTokenSchema);

export default DeviceToken;
