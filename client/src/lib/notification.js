// HTML5 Desktop Notification Manager for Pulse RealTime Chat

class DesktopNotificationManager {
  constructor() {
    this.permission = typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default";
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
    return this.isSupported() && this.permission === "granted";
  }

  sendNotification({ title, body, icon = "/favicon.ico", onClick = null }) {
    if (!this.hasPermission()) return null;

    // Only trigger desktop notification if tab is in the background or hidden
    if (typeof document !== "undefined" && !document.hidden) {
      return null;
    }

    try {
      const notification = new Notification(title || "Pulse Message", {
        body: body || "New message received",
        icon: icon || "/favicon.ico",
        badge: "/favicon.ico",
        silent: true, // We play our custom glass chime sound via soundManager
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (typeof onClick === "function") {
          onClick();
        }
      };

      // Auto close after 5 seconds
      setTimeout(() => {
        try {
          notification.close();
        } catch {}
      }, 5000);

      return notification;
    } catch {
      return null;
    }
  }
}

export const notificationManager = new DesktopNotificationManager();
