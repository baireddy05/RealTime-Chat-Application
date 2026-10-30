import PushSubscription from "../models/PushSubscription.model.js";
import DeviceToken from "../models/DeviceToken.model.js";
import { getVapidPublicKey, isPushConfigured } from "../lib/push.js";
import { isFcmConfigured } from "../lib/fcm.js";

export const getPushConfig = async (req, res) => {
  try {
    res.status(200).json({
      vapidPublicKey: getVapidPublicKey(),
      webPush: isPushConfigured(),
      fcm: isFcmConfigured(),
      commit: process.env.RENDER_GIT_COMMIT || "local",
    });
  } catch (error) {
    console.error("Error in getPushConfig:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

const isValidSubscription = (sub, { allowInsecureLocalhost = false } = {}) =>
  sub &&
  typeof sub.endpoint === "string" &&
  (/^https:\/\//.test(sub.endpoint) ||
    (allowInsecureLocalhost && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(sub.endpoint))) &&
  sub.keys &&
  typeof sub.keys.p256dh === "string" &&
  sub.keys.p256dh.length > 0 &&
  typeof sub.keys.auth === "string" &&
  sub.keys.auth.length > 0;

export const subscribePush = async (req, res) => {
  try {
    const { subscription, userAgent } = req.body || {};
    if (!isValidSubscription(subscription, { allowInsecureLocalhost: true })) {
      return res.status(400).json({ error: "Invalid push subscription" });
    }
    const existing = await PushSubscription.findOne({ endpoint: subscription.endpoint });
    if (existing && existing.userId?.toString() !== req.user._id.toString()) {
      // Endpoint owned by another user — don't silently hijack. Owner must
      // unsubscribe first (logout does this), or re-login transfers it.
      return res.status(409).json({ error: "Endpoint owned by another user" });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        userId: req.user._id,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
        userAgent: typeof userAgent === "string" ? userAgent.slice(0, 300) : "",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Error in subscribePush:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const unsubscribePush = async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    // Require explicit endpoint — never wipe all devices on a malformed call.
    if (typeof endpoint !== "string" || !endpoint) {
      return res.status(400).json({ error: "Missing endpoint" });
    }
    await PushSubscription.deleteMany({ userId: req.user._id, endpoint });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in unsubscribePush:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const registerDeviceToken = async (req, res) => {
  try {
    const { platform, token, appVersion } = req.body || {};
    if (typeof token !== "string" || token.length < 10 || token.length > 4096) {
      return res.status(400).json({ error: "Invalid device token" });
    }
    const safePlatform = ["android", "ios", "web"].includes(platform) ? platform : "android";
    await DeviceToken.findOneAndUpdate(
      { token },
      {
        userId: req.user._id,
        platform: safePlatform,
        appVersion: typeof appVersion === "string" ? appVersion.slice(0, 50) : "",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Error in registerDeviceToken:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const unregisterDeviceToken = async (req, res) => {
  try {
    const { token } = req.body || {};
    if (typeof token !== "string" || !token) {
      return res.status(400).json({ error: "Missing token" });
    }
    await DeviceToken.deleteMany({ userId: req.user._id, token });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in unregisterDeviceToken:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Active SSE notification streams: userId -> Set<Response>
const activeStreams = new Map();

export const streamNotifications = async (req, res) => {
  const userId = req.user._id.toString();

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*",
  });

  res.write(`data: ${JSON.stringify({ type: "connected", userId })}\n\n`);

  if (!activeStreams.has(userId)) {
    activeStreams.set(userId, new Set());
  }
  activeStreams.get(userId).add(res);

  const pinger = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(pinger);
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(pinger);
    const userSet = activeStreams.get(userId);
    if (userSet) {
      userSet.delete(res);
      if (userSet.size === 0) activeStreams.delete(userId);
    }
  });
};

export const sendSsePush = (userId, payload) => {
  const uId = userId?.toString();
  const userSet = activeStreams.get(uId);
  if (!userSet || userSet.size === 0) return 0;

  const dataStr = `data: ${JSON.stringify(payload)}\n\n`;
  let sent = 0;
  for (const client of userSet) {
    try {
      client.write(dataStr);
      sent++;
    } catch {}
  }
  return sent;
};
