import DeviceToken from "../models/DeviceToken.model.js";

let admin = null;
let initAttempted = false;

// Lazily initializes firebase-admin from FIREBASE_SERVICE_ACCOUNT, which may
// be either a JSON string or a path to the service-account JSON file.
// Returns null (and stays silent afterwards) when unconfigured so the rest
// of the app keeps working on Web Push alone.
const getAdmin = async () => {
  if (admin) return admin;
  if (initAttempted) return null;
  initAttempted = true;

  const cred = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!cred) {
    console.warn(
      "[FCM] FIREBASE_SERVICE_ACCOUNT not set — native push disabled. Web Push still works for browsers/PWA."
    );
    return null;
  }
  try {
    const { initializeApp, cert, getApps } = await import("firebase-admin/app");
    const { getMessaging } = await import("firebase-admin/messaging");
    let serviceAccount = null;
    const trimmed = cred.trim();
    if (trimmed.startsWith("{")) {
      serviceAccount = JSON.parse(trimmed);
    } else if (trimmed.startsWith("ey")) {
      // Base64-encoded JSON (safe for multi-line env vars on Render/Heroku)
      serviceAccount = JSON.parse(Buffer.from(trimmed, "base64").toString("utf8"));
    } else {
      const fs = await import("fs");
      const path = await import("path");
      let resolved = path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
      if (!fs.existsSync(resolved)) {
        const serverRelative = path.resolve(process.cwd(), "server", trimmed);
        if (fs.existsSync(serverRelative)) {
          resolved = serverRelative;
        }
      }
      serviceAccount = JSON.parse(fs.readFileSync(resolved, "utf8"));
    }
    // Private keys pasted into .env often carry literal \n sequences
    if (serviceAccount.private_key && serviceAccount.private_key.includes("\\n")) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    const apps = getApps();
    const app = apps.length > 0 ? apps[0] : initializeApp({ credential: cert(serviceAccount) });
    admin = { messaging: () => getMessaging(app) };
    console.log("[FCM] firebase-admin initialized — native push enabled");
    return admin;
  } catch (err) {
    console.error("[FCM] Initialization failed, native push disabled:", err.message);
    return null;
  }
};

export const isFcmConfigured = () => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);

// Data + notification message to every registered device of a user.
// Invalid tokens (messaging/invalid-registration-token,
// messaging/registration-token-not-registered) are pruned.
export const sendFcm = async (userId, { title, body, data = {} }) => {
  const sdk = await getAdmin();
  if (!sdk) return { attempted: 0, delivered: 0, pruned: 0 };
  let tokens = [];
  try {
    tokens = await DeviceToken.find({ userId }).lean();
  } catch (err) {
    console.error("[FCM] Token lookup failed:", err.message);
    return { attempted: 0, delivered: 0, pruned: 0 };
  }
  if (tokens.length === 0) return { attempted: 0, delivered: 0, pruned: 0 };

  const stringData = Object.fromEntries(
    Object.entries({ ...data, title: title || "Pulse Messenger", body: body || "New activity" }).map(([k, v]) => [
      k,
      String(v),
    ])
  );

  // WhatsApp-style FCM architecture:
  // WhatsApp and Telegram NEVER send a root "notification" payload on Android.
  // If an FCM message has a "notification" block, Google Play Services intercepts
  // it and BYPASSES onMessageReceived() when the app is in background or closed.
  // When bypassed, custom Java code cannot run, messages CANNOT be stacked (InboxStyle),
  // and each new message replaces the previous one.
  // A pure DATA payload with priority: "high" wakes up PulseFirebaseMessagingService
  // even when the app is swiped away from recent apps, executing onMessageReceived()
  // to dynamically stack all unread messages per chat into an InboxStyle notification.
  const message = {
    tokens: tokens.map((t) => t.token),
    data: stringData,
    android: {
      priority: "high",
    },
  };

  try {
    const res = await sdk.messaging().sendEachForMulticast(message);
    console.log(
      `[FCM] Dispatched to ${tokens.length} devices for user ${userId}: ${res.successCount} delivered, ${res.failureCount} failed`
    );
    const dead = [];
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = String(r.error?.code || "").toLowerCase();
        if (
          code.includes("invalid-registration-token") ||
          code.includes("registration-token-not-registered") ||
          code.includes("unregistered") ||
          code.includes("not-found") ||
          code.includes("invalid-argument")
        ) {
          dead.push(tokens[i]._id);
        } else {
          console.warn(`[FCM] Send failed for ${String(tokens[i]._id).slice(-6)}:`, code || r.error?.message);
        }
      }
    });
    if (dead.length > 0) {
      await DeviceToken.deleteMany({ _id: { $in: dead } }).catch(() => {});
    }
    return { attempted: tokens.length, delivered: res.successCount, pruned: dead.length };
  } catch (err) {
    console.error("[FCM] Multicast send failed:", err.message);
    return { attempted: tokens.length, delivered: 0, pruned: 0 };
  }
};
