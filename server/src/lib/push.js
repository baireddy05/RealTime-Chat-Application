import webpush from "web-push";
import PushSubscription from "../models/PushSubscription.model.js";

let configured = false;

const ensureConfigured = () => {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn(
      "[Push] VAPID keys missing — Web Push disabled. Run `npm run gen:vapid` and set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY."
    );
    return false;
  }
  try {
    webpush.setVapidDetails(
      VAPID_SUBJECT || "mailto:admin@pulse.chat",
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    configured = true;
    return true;
  } catch (err) {
    console.error("[Push] Invalid VAPID keys:", err.message);
    return false;
  }
};

export const isPushConfigured = () => ensureConfigured();

export const getVapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;

// Send one payload to every subscription of a user.
// Dead endpoints (410/404 from the push service) are pruned automatically.
// All other failures are logged and swallowed so messaging never breaks.
export const sendWebPush = async (userId, payload) => {
  if (!ensureConfigured()) return { attempted: 0, delivered: 0, pruned: 0 };
  let subs = [];
  try {
    subs = await PushSubscription.find({ userId }).lean();
  } catch (err) {
    console.error("[Push] Subscription lookup failed:", err.message);
    return { attempted: 0, delivered: 0, pruned: 0 };
  }
  if (subs.length === 0) return { attempted: 0, delivered: 0, pruned: 0 };

  const body = JSON.stringify(payload);
  let delivered = 0;
  const dead = [];
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          body,
          { TTL: 24 * 60 * 60 }
        );
        delivered += 1;
      } catch (err) {
        // web-push rejects with statusCode from the push service
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          dead.push(sub._id);
        } else {
          console.warn(`[Push] Send failed for ${String(sub._id).slice(-6)}:`, err?.message || err);
        }
      }
    })
  );

  if (dead.length > 0) {
    try {
      await PushSubscription.deleteMany({ _id: { $in: dead } });
    } catch (err) {
      console.error("[Push] Dead-subscription cleanup failed:", err.message);
    }
  }
  return { attempted: subs.length, delivered, pruned: dead.length };
};
