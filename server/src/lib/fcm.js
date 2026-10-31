import DeviceToken from "../models/DeviceToken.model.js";

let admin = null;
let initAttempted = false;
let initError = null;

// Lazily initializes firebase-admin from FIREBASE_SERVICE_ACCOUNT, which may
// be either a JSON string or a path to the service-account JSON file.
// Returns null (and stays silent afterwards) when unconfigured so the rest
// of the app keeps working on Web Push alone.
export const getAdmin = async () => {
  if (admin) return admin;
  if (initAttempted) return admin;
  initAttempted = true;

  const cred = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!cred) {
    initError = "FIREBASE_SERVICE_ACCOUNT not set";
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
    } else {
      // Try Base64-encoded JSON first (Render/Heroku multi-line env var)
      try {
        const decoded = Buffer.from(trimmed, "base64").toString("utf8");
        if (decoded.trim().startsWith("{")) {
          serviceAccount = JSON.parse(decoded);
        }
      } catch (ignored) {}

      // If not Base64 JSON, try resolving as file path
      if (!serviceAccount) {
        const fs = await import("fs");
        const path = await import("path");
        let resolved = path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
        if (!fs.existsSync(resolved)) {
          const serverRelative = path.resolve(process.cwd(), "server", trimmed);
          if (fs.existsSync(serverRelative)) {
            resolved = serverRelative;
          }
        }
        if (!fs.existsSync(resolved)) {
          throw new Error(`Service account file not found at ${resolved}`);
        }
        serviceAccount = JSON.parse(fs.readFileSync(resolved, "utf8"));
      }
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
    initError = err.message;
    console.error("[FCM] Initialization failed, native push disabled:", err.message);
    return null;
  }
};

export const getFcmStatus = async () => {
  const sdk = await getAdmin();
  return {
    configured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
    active: Boolean(sdk),
    error: initError,
  };
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

  // Pure DATA payload with priority: "high" wakes up PulseFirebaseMessagingService
  // even when the app is swiped away from recent apps, executing onMessageReceived()
  // to dynamically stack all unread messages per chat into an InboxStyle notification.
  // We NEVER include a root "notification" block; doing so causes Google Play Services
  // to post an un-stacked duplicate notification in addition to our service.
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
