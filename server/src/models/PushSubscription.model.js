import mongoose from "mongoose";

// One document per browser/device push subscription (Web Push / PWA).
// Endpoint URLs are unique per subscription; a user may have several
// (phone + laptop + tablet).
const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ userId: 1 });

const PushSubscription = mongoose.model("PushSubscription", pushSubscriptionSchema);

export default PushSubscription;
