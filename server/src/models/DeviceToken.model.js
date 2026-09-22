import mongoose from "mongoose";

// Native device tokens for the Capacitor Android app (FCM registration
// tokens reported by @capacitor/push-notifications). One per device.
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
