import { getUserSocketIds } from "./socket.js";
import { sendWebPush } from "./push.js";
import { sendFcm } from "./fcm.js";
import { sendSsePush } from "../controllers/push.controller.js";
import crypto from "crypto";

// Decrypt E2EE message text for push notification preview
const decryptMessageText = (ciphertextStr, { senderId, receiverId, roomId }) => {
  if (!ciphertextStr || typeof ciphertextStr !== "string" || !ciphertextStr.startsWith("[e2ee]:")) {
    return ciphertextStr;
  }
  try {
    let keyString = "pulse-default-secure-vault-key";
    if (roomId) {
      keyString = `pulse-room-key-${String(roomId)}`;
    } else if (senderId && receiverId) {
      const ids = [String(senderId), String(receiverId)].sort();
      keyString = `pulse-dm-key-${ids[0]}-${ids[1]}`;
    }
    const keyHash = crypto.createHash("sha256").update(keyString).digest();

    const raw = ciphertextStr.slice(7);
    const [ivHex, cipherHex] = raw.split(":");
    if (!ivHex || !cipherHex) return null;

    const iv = Buffer.from(ivHex, "hex");
    const ciphertextWithTag = Buffer.from(cipherHex, "hex");
    if (ciphertextWithTag.length < 16) return null;

    const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);
    const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);

    const decipher = crypto.createDecipheriv("aes-256-gcm", keyHash, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (err) {
    return null;
  }
};

// Build push preview from message fields, resolving E2EE ciphertext to clear text for notifications
export const previewForMessage = (msg, context = {}) => {
  if (!msg) return "New message";

  let plainText = msg.text;
  if (msg.isEncrypted || (typeof msg.text === "string" && msg.text.startsWith("[e2ee]:"))) {
    const senderId = msg.senderId?._id?.toString?.() || msg.senderId?.toString?.();
    const receiverId = context.receiverId?.toString?.() || msg.receiverId?._id?.toString?.() || msg.receiverId?.toString?.();
    const roomId = context.room?._id?.toString?.() || msg.roomId?.toString?.();
    const decrypted = decryptMessageText(msg.text, { senderId, receiverId, roomId });
    if (decrypted) plainText = decrypted;
  }

  if (typeof plainText === "string" && plainText.trim() && !plainText.startsWith("[e2ee]:")) {
    const t = plainText.trim();
    return t.length > 120 ? `${t.slice(0, 120)}…` : t;
  }
  if (msg.image) return "📷 Photo";
  if (msg.videoNote) return "🎬 Video message";
  if (msg.audio) return "🎤 Voice message";
  if (msg.file && (msg.file.url || msg.file.name)) return `📎 ${msg.file.name || "File"}`;
  if (msg.contact && (msg.contact.fullName || msg.contact.username || msg.contact.phone)) return "👤 Shared contact";
  if (msg.poll && msg.poll.question) return "📊 New poll";
  if (msg.location && (msg.location.lat != null || msg.location.name)) return msg.location.name ? `📍 ${msg.location.name}` : "📍 Shared location";
  if (msg.isSticker) return "⭐ Sticker";
  return "New message";
};

const hasLiveSocket = (userId) => {
  try {
    return getUserSocketIds(userId).length > 0;
  } catch {
    return false; // fail closed: transient errors must not suppress push
  }
};

// Fan out to every transport a user has. Fire-and-forget safe: every
// transport swallows its own errors so messaging/calling never breaks.
export const notifyUser = async (userId, { title, body, data = {} }) => {
  if (!userId) return { web: null, fcm: null };
  const payload = {
    title: title || "Pulse Messenger",
    body: body || "New activity",
    icon: "/favicon.png",
    badge: "/favicon.png",
    data,
  };
  // Send instantly to native Android Background Service via SSE stream
  try {
    sendSsePush(userId, payload);
  } catch (err) {
    console.error("[Notify] SSE push failed:", err.message);
  }
  const [web, fcm] = await Promise.all([
    sendWebPush(userId, payload).catch((err) => {
      console.error("[Notify] web push failed:", err.message);
      return null;
    }),
    sendFcm(userId, { title: payload.title, body: payload.body, data }).catch((err) => {
      console.error("[Notify] FCM failed:", err.message);
      return null;
    }),
  ]);
  return { web, fcm };
};

// Push a newly arrived chat message to recipients with no live socket.
// `room` is { _id, name, members } for group messages, null for DMs.
export const notifyNewMessage = async ({ message, senderName, room = null, receiverId = null }) => {
  try {
    const body = previewForMessage(message, { room, receiverId });
    const msgId = message?._id?.toString?.() || message?._id;
    if (room) {
      const title = `${room.name || "Group"} • ${senderName || "Someone"}`;
      // senderId may be populated object or raw id
      const senderIdStr = message?.senderId?._id?.toString?.() || message?.senderId?.toString?.();
      const targets = (room.members || [])
        .map((m) => m?._id?.toString?.() || m?.toString?.() || m)
        .filter((id) => typeof id === "string" && id && id !== senderIdStr);
      console.log(`[Notify] Sending group push notification to ${targets.length} members for room ${room._id}`);
      await Promise.all(
        targets.map((id) =>
          notifyUser(id, {
            title,
            body,
            data: {
              type: "message",
              chatType: "room",
              chatId: room._id?.toString?.() || room._id,
              messageId: msgId,
              senderName: senderName || "Someone",
            },
          })
        )
      );
    } else if (receiverId) {
      const rid = receiverId?._id?.toString?.() || receiverId?.toString?.() || receiverId;
      const dmPeer = message?.senderId?._id?.toString?.() || message?.senderId?.toString?.() || message?.senderId;
      console.log(`[Notify] Sending DM push notification to receiver ${rid} from ${senderName}`);
      await notifyUser(rid, {
        title: senderName || "New message",
        body,
        data: {
          type: "message",
          chatType: "user",
          chatId: dmPeer,
          messageId: msgId,
          senderName: senderName || "New message",
        },
      });
    }
  } catch (err) {
    console.error("[Notify] notifyNewMessage failed:", err.message);
  }
};

export const notifyIncomingCall = async ({ callerId, callerName, receiverId, callType = "video" }) => {
  try {
    const rid = receiverId?.toString?.() || receiverId;
    const label = callType === "audio" ? "Voice" : "Video";
    await notifyUser(rid, {
      title: `Incoming ${label} call`,
      body: `${callerName || "Someone"} is calling you`,
      data: { type: "call", callType, callerId: callerId?.toString?.() || callerId, callerName: callerName || "" },
    });
  } catch (err) {
    console.error("[Notify] notifyIncomingCall failed:", err.message);
  }
};
