import { axiosInstance } from "./axios";

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

/** Navigate to a push target. Full reload when the app isn't running;
 *  in-app event when it is (HomePage listens for it). */
export function handlePushAction(data) {
  const d = data || {};
  try {
    let url = null;
    if (d.type === "message" && d.chatId) {
      url = `/?chat=${encodeURIComponent(`${d.chatType || "user"}:${d.chatId}`)}`;
    } else if (d.type === "call" && d.callerId) {
      url = `/?callFrom=${encodeURIComponent(d.callerId)}`;
    }
    if (!url) return;
    if (typeof document !== "undefined" && !document.hidden && window.location.pathname === "/") {
      const ev = d.type === "call"
        ? new CustomEvent("pulse:open-call-from", { detail: d })
        : new CustomEvent("pulse:open-chat", { detail: d });
      window.dispatchEvent(ev);
    } else {
      window.location.href = url;
    }
  } catch (err) {
    console.warn("[Push] action handling failed:", err?.message || err);
  }
}

// Called after login/signup/auth-check: wires the web transport.
// Never throws; never prompts by itself (permission UX lives in Settings).
export async function ensurePushTransports() {
  return ensureWebPushSubscription();
}

export async function disablePushTransports() {
  await disableWebPush();
}
