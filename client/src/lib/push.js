import { axiosInstance } from "./axios";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

// Web Push manager for browsers and installed PWAs. All failures are
// local-only and silent so auth and messaging flows never break because
// of push.

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
};

const webPushSupported = () =>
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

// --- Web Push (browsers + installed PWA) ---

export async function ensureWebPushSubscription() {
  if (!webPushSupported()) return { ok: false, reason: "unsupported" };
  if (Notification.permission !== "granted") return { ok: false, reason: "no-permission" };
  try {
    // NOTE: axiosInstance.baseURL already ends in /api, so paths are /push/*.
    const { data } = await axiosInstance.get("/push/config");
    if (!data?.vapidPublicKey) return { ok: false, reason: "not-configured" };
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error("sw-timeout")), 8000)),
    ]);
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.vapidPublicKey),
      });
    }
    // Upsert is idempotent server-side; keeps keys fresh after rotation.
    await axiosInstance.post("/push/subscribe", {
      subscription: sub.toJSON(),
      userAgent: navigator.userAgent,
    });
    return { ok: true };
  } catch (err) {
    console.warn("[Push] Web subscribe failed:", err?.message || err);
    return { ok: false, reason: "subscribe-failed" };
  }
}

export async function disableWebPush() {
  try {
    if (!webPushSupported()) return;
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error("sw-timeout")), 8000)),
    ]);
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      // Unsubscribe client first so a server failure can't orphan the endpoint
      // client-side; server prune happens on next send failure.
      await sub.unsubscribe();
      try {
        await axiosInstance.post("/push/unsubscribe", { endpoint: sub.endpoint });
      } catch {}
    }
  } catch (err) {
    console.warn("[Push] Web unsubscribe failed:", err?.message || err);
  }
}

/** Open chat or call directly from push or notification action */
export function handlePushAction(data) {
  const d = data || {};
  try {
    const chatId = d.chatId || d.callerId || d.userId;
    const chatType = d.chatType || (d.type === "call" ? "user" : "user");
    if (chatId) {
      import("../store/useChatStore").then(({ useChatStore }) => {
        useChatStore.getState().openChatById(chatId, chatType, d);
      }).catch(() => {});
    }

    const ev = d.type === "call"
      ? new CustomEvent("pulse:open-call-from", { detail: d })
      : new CustomEvent("pulse:open-chat", { detail: d });
    window.dispatchEvent(ev);
  } catch (err) {
    console.warn("[Push] action handling failed:", err?.message || err);
  }
}

// --- Native Android FCM Push Notifications (WhatsApp-style) ---

let nativePushRegistered = false;

export async function registerNativePush() {
  if (!Capacitor.isNativePlatform()) return { ok: false, reason: "web-platform" };
  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== "granted") {
      console.warn("[FCM] Push notification permission not granted");
      return { ok: false, reason: "denied" };
    }

    // Always sync cached FCM token with server so the active logged-in user is bound to this device
    const cachedToken = localStorage.getItem("pulse_fcm_token");
    if (cachedToken) {
      axiosInstance.post("/push/device-token", {
        platform: "android",
        token: cachedToken,
        appVersion: "2.0.9",
      }).catch(() => {});
    }

    if (!nativePushRegistered) {
      nativePushRegistered = true;

      PushNotifications.addListener("registration", async (token) => {
        console.log("[FCM] Registration token received:", token?.value);
        try {
          if (token?.value) {
            await axiosInstance.post("/push/device-token", {
              platform: "android",
              token: token.value,
              appVersion: "2.0.9",
            });
            localStorage.setItem("pulse_fcm_token", token.value);
            console.log("[FCM] Token registered with server successfully");
          }
        } catch (err) {
          console.warn("[FCM] Error registering token with server:", err?.message || err);
        }
      });

      PushNotifications.addListener("registrationError", (err) => {
        console.warn("[FCM] Registration error:", err?.error || err);
      });

      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("[FCM] Push received in foreground:", notification);
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        console.log("[FCM] Push action performed:", action);
        const data = action?.notification?.data;
        if (data) {
          handlePushAction(data);
        }
      });
    }

    await PushNotifications.register();
    return { ok: true };
  } catch (err) {
    console.warn("[FCM] registerNativePush error:", err?.message || err);
    return { ok: false, reason: "error" };
  }
}

export async function disableNativePush() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const token = localStorage.getItem("pulse_fcm_token");
    if (token) {
      await axiosInstance.delete("/push/device-token", { data: { token } }).catch(() => {});
      localStorage.removeItem("pulse_fcm_token");
    }
  } catch {}
}

// Called after login/signup/auth-check: wires web and native transports
export async function ensurePushTransports() {
  if (Capacitor.isNativePlatform()) {
    return registerNativePush();
  }
  return ensureWebPushSubscription();
}

export async function disablePushTransports() {
  if (Capacitor.isNativePlatform()) {
    await disableNativePush();
  } else {
    await disableWebPush();
  }
}
