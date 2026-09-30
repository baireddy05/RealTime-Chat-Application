import { getUserSocketIds } from "./socket.js";
import { sendWebPush } from "./push.js";
import { sendFcm } from "./fcm.js";

// Build a privacy-safe push preview from server-visible fields only.
// Encrypted bodies are opaque here by design — never include ciphertext.
export const previewForMessage = (msg) => {
  if (!msg) return "New message";
  if (!msg.isEncrypted && typeof msg.text === "string" && msg.text.trim()) {
    const t = msg.text.trim();
    return t.length > 120 ? `${t.slice(0, 120)}…` : t;
  }
  if (msg.image) return "📷 Photo";
  if (msg.videoNote) return "🎬 Video message";
  if (msg.audio) return "🎤 Voice message";
  if (msg.file) return `📎 ${msg.file?.name || "File"}`;
  if (msg.contact) return "👤 Shared contact";
  if (msg.poll) return "📊 New poll";
  if (msg.location) return msg.location.name ? `📍 ${msg.location.name}` : "📍 Shared location";
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
    const body = previewForMessage(message);
    const msgId = message?._id?.toString?.() || message?._id;
    if (room) {
      const title = `${room.name || "Group"} • ${senderName || "Someone"}`;
      // senderId may be populated object or raw id
      const senderIdStr = message?.senderId?._id?.toString?.() || message?.senderId?.toString?.();
      const targets = (room.members || [])
        .map((m) => m?._id?.toString?.() || m?.toString?.() || m)
        .filter((id) => typeof id === "string" && id && id !== senderIdStr);
      await Promise.all(
        targets
          .filter((id) => id !== senderIdStr && !hasLiveSocket(id))
          .map((id) =>
            notifyUser(id, {
              title,
              body,
              data: { type: "message", chatType: "room", chatId: room._id?.toString?.() || room._id, messageId: msgId },
            })
          )
      );
    } else if (receiverId) {
      const rid = receiverId?._id?.toString?.() || receiverId?.toString?.() || receiverId;
      const dmPeer = message?.senderId?._id?.toString?.() || message?.senderId?.toString?.() || message?.senderId;
      if (!hasLiveSocket(rid)) {
        await notifyUser(rid, {
          title: senderName || "New message",
          body,
          data: { type: "message", chatType: "user", chatId: dmPeer, messageId: msgId },
        });
      }
    }
  } catch (err) {
    console.error("[Notify] notifyNewMessage failed:", err.message);
  }
};

export const notifyIncomingCall = async ({ callerId, callerName, receiverId, callType = "video" }) => {
  try {
    const rid = receiverId?.toString?.() || receiverId;
    if (hasLiveSocket(rid)) return; // in-app ringing handles it
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
