// Service Worker & Web Push Notification Manager for Pulse RealTime Chat

class DesktopNotificationManager {
  constructor() {
    this.permission =
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "default";
    this.swRegistration = null;

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        this.initServiceWorker();
      });
    }
  }

  async initServiceWorker() {
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.register("/sw.js");
        this.swRegistration = reg;
        console.log("[Pulse SW] Service worker registered with scope:", reg.scope);
      }
    } catch (err) {
      console.warn("[Pulse SW] Service worker registration failed:", err);
    }
  }

  async requestPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "denied";
    }

    try {
      const result = await Notification.requestPermission();
      this.permission = result;
      return result;
    } catch {
      return "denied";
    }
  }

  isSupported() {
    return typeof window !== "undefined" && "Notification" in window;
  }

  hasPermission() {
    if (!this.isSupported()) return false;
    try {
      // Re-read live permission; cached value goes stale if user changes it in browser UI.
      this.permission = Notification.permission;
    } catch {}
    return this.permission === "granted";
  }

  async sendNotification({
    title,
    body,
    icon = "/favicon.png",
    tag = null,
    data = null,
    onClick = null,
  }) {
    if (!this.hasPermission()) return null;

    // Only trigger desktop notification if tab is in the background or hidden
    if (typeof document !== "undefined" && !document.hidden) {
      return null;
    }

    try {
      // Unique tag per conversation/message so stacked messages don't replace each other.
      const effectiveTag = tag || `pulse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // Try to use Service Worker notification if available
      if (this.swRegistration && "showNotification" in this.swRegistration) {
        await this.swRegistration.showNotification(title || "Pulse Message", {
          body: body || "New message received",
          icon: icon || "/favicon.png",
          badge: "/favicon.png",
          tag: effectiveTag,
          vibrate: [150, 80, 150],
          data: { ...(data || { url: typeof window !== "undefined" ? window.location.href : "/" }), onClickId: effectiveTag },
        });
        // Store click handler for SW notifications; HomePage wires notificationclick via service worker message.
        try {
          if (typeof onClick === "function" && typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("pulse:notification-queued", { detail: { tag: effectiveTag } }));
          }
        } catch {}
        return true;
      }

      // Fallback to standard Notification API
      const notification = new Notification(title || "Pulse Message", {
        body: body || "New message received",
        icon: icon || "/favicon.png",
        badge: "/favicon.png",
        tag: effectiveTag,
        silent: true,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (typeof onClick === "function") {
          onClick();
        }
      };

      setTimeout(() => {
        try {
          notification.close();
        } catch {}
      }, 5000);

      return notification;
    } catch (e) {
      console.warn("Notification dispatch error:", e);
      return null;
    }
  }
}

export const notificationManager = new DesktopNotificationManager();
