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
    const { default: adminLib } = await import("firebase-admin");
    let serviceAccount = null;
    const trimmed = cred.trim();
    if (trimmed.startsWith("{")) {
      serviceAccount = JSON.parse(trimmed);
    } else {
      const fs = await import("fs");
      serviceAccount = JSON.parse(fs.readFileSync(trimmed, "utf8"));
    }
    // Private keys pasted into .env often carry literal \n sequences
    if (serviceAccount.private_key && serviceAccount.private_key.includes("\\n")) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    adminLib.initializeApp({ credential: adminLib.credential.cert(serviceAccount) });
    admin = adminLib;
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
    Object.entries({ ...data, title: title || "", body: body || "" }).map(([k, v]) => [k, String(v)])
  );
  const message = {
    tokens: tokens.map((t) => t.token),
    notification: { title: title || "Pulse Messenger", body: body || "New activity" },
    data: { ...stringData, click_action: "FLUTTER_NOTIFICATION_CLICK" },
    android: { priority: "high", notification: { channelId: "pulse_messages", sound: "default" } },
  };

  try {
    const res = await sdk.messaging().sendEachForMulticast(message);
    const dead = [];
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || "";
        if (
          code.includes("invalid-registration-token") ||
          code.includes("registration-token-not-registered")
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
