// Service Worker, Web Push & Native Capacitor Local Notification Manager for Pulse RealTime Chat
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Haptics, NotificationType } from "@capacitor/haptics";
import { handlePushAction } from "./push";

export function getNotificationId(tag, data) {
  const key = tag || data?.chatId || (data?.type === "call" ? `call_${data?.callerId}` : null);
  if (!key) return 1001;
  let hash = 0;
  const str = String(key);
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 2147483640) + 1;
}

export function showInAppBanner({ title, body, icon, onClick }) {
  if (typeof document === "undefined") return;
  try {
    let banner = document.getElementById("pulse-in-app-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "pulse-in-app-banner";
      banner.className = "pulse-in-app-banner";
      document.body.appendChild(banner);
    }

    const safeTitle = (title || "Pulse Message").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeBody = (body || "New message").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeIcon = icon || "/favicon.png";

    banner.innerHTML = `
      <div class="pulse-banner-inner">
        <img class="pulse-banner-avatar" src="${safeIcon}" onerror="this.src='/favicon.png'" />
        <div class="pulse-banner-text">
          <div class="pulse-banner-title">${safeTitle}</div>
          <div class="pulse-banner-body">${safeBody}</div>
        </div>
      </div>
    `;

    banner.onclick = () => {
      banner.classList.remove("visible");
      if (typeof onClick === "function") onClick();
    };

    if (banner._timer) clearTimeout(banner._timer);
    requestAnimationFrame(() => {
      banner.classList.add("visible");
    });

    banner._timer = setTimeout(() => {
      banner.classList.remove("visible");
    }, 4500);
  } catch (e) {
    console.warn("[Pulse InApp Banner] error:", e);
  }
}

const STACKS_STORAGE_KEY = "pulse_notif_stacks_v1";

function loadStoredStacks() {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(STACKS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const valid = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && Array.isArray(v.lines) && now - (v.lastUpdated || 0) < 24 * 60 * 60 * 1000) {
        valid[k] = v;
      }
    }
    return valid;
  } catch {
    return {};
  }
}

function saveStoredStacks(stacks) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(STACKS_STORAGE_KEY, JSON.stringify(stacks));
  } catch {}
}

class UnifiedNotificationManager {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.permission =
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "default";
    this.nativePermission = "prompt";
    this.swRegistration = null;
    this.nativeInitialized = false;
    this._messageStacks = loadStoredStacks();

    if (this.isNative) {
      this.initNative().catch((err) => {
        console.warn("[Pulse Notification] initNative error:", err);
      });
    } else if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        this.initServiceWorker();
      });
    }
  }

  async initNative() {
    if (!this.isNative || this.nativeInitialized) return;
    this.nativeInitialized = true;
    try {
      // Clean up legacy channels if present
      await LocalNotifications.deleteChannel({ id: "pulse_messages" }).catch(() => {});
      await LocalNotifications.deleteChannel({ id: "pulse_calls" }).catch(() => {});

      // 1. Create Android Notification Channels (Heads-up / Pop on screen with default sound & vibration)
      await LocalNotifications.createChannel({
        id: "pulse_messages_v2",
        name: "Pulse Messages",
        description: "Incoming messages and notifications",
        importance: 5, // High: Heads-up banner with sound & vibration
        visibility: 1, // Public (lockscreen)
        vibration: true,
        lights: true,
        lightColor: "#00E5FF",
      }).catch((e) => console.warn("[LocalNotifications] create messages channel:", e));

      await LocalNotifications.createChannel({
        id: "pulse_calls_v2",
        name: "Pulse Calls",
        description: "Incoming voice and video calls",
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: "#00E5FF",
      }).catch((e) => console.warn("[LocalNotifications] create calls channel:", e));

      // 2. Setup notification action listener (when user taps the notification)
      LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
        try {
          const extra = action?.notification?.extra;
          const targetKey = extra?.chatKey || extra?.chatId;
          if (targetKey) {
            this.clearNotification(targetKey);
          }
          if (extra) {
            handlePushAction(extra);
          }
        } catch (e) {
          console.warn("[LocalNotifications] action handler error:", e);
        }
      });

      // 3. Check current permission state
      const check = await LocalNotifications.checkPermissions();
      this.nativePermission = check.display;
    } catch (err) {
      console.warn("[LocalNotifications] initNative failed:", err);
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
    if (this.isNative) {
      try {
        await this.initNative();
        const res = await LocalNotifications.requestPermissions();
        this.nativePermission = res.display;
        return res.display === "granted" ? "granted" : "denied";
      } catch (err) {
        console.warn("[LocalNotifications] requestPermissions error:", err);
        return "denied";
      }
    }

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
    if (this.isNative) return true;
    return typeof window !== "undefined" && "Notification" in window;
  }

  hasPermission() {
    if (this.isNative) {
      return this.nativePermission === "granted";
    }
    if (!this.isSupported()) return false;
    try {
      this.permission = Notification.permission;
    } catch {}
    return this.permission === "granted";
  }

  async sendNotification({
    title,
    chatTitle = null,
    body,
    icon = "/favicon.png",
    tag = null,
    data = null,
    onClick = null,
    channelId = null,
    force = false,
  }) {
    const isCall = data?.type === "call";

    // 1. If inside app and document is visible, show in-app banner with haptic vibration!
    if (typeof document !== "undefined" && !document.hidden) {
      showInAppBanner({
        title,
        body,
        icon,
        onClick: () => {
          if (typeof onClick === "function") {
            onClick();
          } else if (data) {
            handlePushAction(data);
          }
        },
      });
      if (this.isNative) {
        Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      }
    }

    // 2. Schedule native notification
    if (this.isNative) {
      // If user is actively looking at this conversation right now in the foreground, skip tray notification
      if (!force && typeof document !== "undefined" && !document.hidden) {
        return true;
      }

      try {
        await this.initNative();
        if (this.nativePermission !== "granted") {
          const perm = await this.requestPermission();
          if (perm !== "granted") {
            return false;
          }
        }

        const chatKey = String(tag || data?.chatId || (isCall ? `call_${data?.callerId}` : "default"));
        const notifId = getNotificationId(chatKey);

        if (isCall) {
          // Voice/Video Call Notification
          await LocalNotifications.schedule({
            notifications: [
              {
                id: notifId,
                title: title || "Incoming Call",
                body: body || "Pulse Audio/Video Call",
                channelId: "pulse_calls_v2",
                smallIcon: "ic_stat_pulse",
                isExactNotification: false,
                extra: { ...(data || {}), chatKey, notificationId: notifId },
              },
            ],
          });
          return true;
        }

        // --- WhatsApp-style InboxStyle Message Stacking ---
        const baseTitle = chatTitle || title || "Pulse Messenger";
        const messageText = body || "New message";

        // Format line for group chats vs 1-on-1 chats
        let line = messageText;
        if (data?.chatType === "room" && data?.senderName) {
          if (!messageText.startsWith(`${data.senderName}:`)) {
            line = `${data.senderName}: ${messageText}`;
          }
        }

        if (!this._messageStacks[chatKey]) {
          this._messageStacks[chatKey] = {
            baseTitle,
            lines: [],
            lastUpdated: Date.now(),
            data: data || {},
          };
        }

        const stack = this._messageStacks[chatKey];
        stack.baseTitle = baseTitle || stack.baseTitle;
        stack.lines.push(line);
        stack.lastUpdated = Date.now();
        if (data) stack.data = { ...(stack.data || {}), ...data };
        saveStoredStacks(this._messageStacks);

        const totalMessages = stack.lines.length;
        const notifTitle = totalMessages > 1
          ? `${stack.baseTitle} (${totalMessages} messages)`
          : stack.baseTitle;

        // When collapsed: show newest message
        const collapsedBody = stack.lines[stack.lines.length - 1];

        // When expanded: show stacked lines (WhatsApp-style InboxStyle)
        // Keep up to 7 lines visible: if more, show `+X earlier messages`
        let inboxList;
        if (totalMessages <= 7) {
          inboxList = [...stack.lines];
        } else {
          const earlierCount = totalMessages - 6;
          inboxList = [`+ ${earlierCount} earlier messages`, ...stack.lines.slice(-6)];
        }

        await LocalNotifications.schedule({
          notifications: [
            {
              id: notifId,
              title: notifTitle,
              body: collapsedBody,
              inboxList: inboxList,
              channelId: channelId || "pulse_messages_v2",
              smallIcon: "ic_stat_pulse",
              isExactNotification: false,
              extra: { ...(data || {}), chatKey, notificationId: notifId },
            },
          ],
        });
        return true;
      } catch (e) {
        console.warn("[LocalNotifications] schedule error:", e);
        return false;
      }
    }

    // 3. Web browser notification
    if (!this.hasPermission()) return null;
    if (!force && typeof document !== "undefined" && !document.hidden) {
      return null;
    }

    try {
      const effectiveTag = tag || `pulse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (this.swRegistration && "showNotification" in this.swRegistration) {
        await this.swRegistration.showNotification(title || "Pulse Message", {
          body: body || "New message received",
          icon: icon || "/favicon.png",
          badge: "/favicon.png",
          tag: effectiveTag,
          vibrate: [150, 80, 150],
          data: { ...(data || { url: typeof window !== "undefined" ? window.location.href : "/" }), onClickId: effectiveTag },
        });
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

  async clearNotification(chatOrTagId) {
    if (!chatOrTagId) return;
    const target = typeof chatOrTagId === "object" ? chatOrTagId : { id: chatOrTagId };
    const rawKeys = [
      target.id,
      target._id,
      target.chatId,
      target.tag,
      typeof chatOrTagId === "string" ? chatOrTagId : null,
    ]
      .filter(Boolean)
      .map(String);

    const matchedKeys = new Set(rawKeys);

    // Also match any stack whose stored data references this chat or caller
    for (const [key, stack] of Object.entries(this._messageStacks)) {
      const sChatId = stack?.data?.chatId ? String(stack.data.chatId) : null;
      const sCallerId = stack?.data?.callerId ? String(stack.data.callerId) : null;
      if (
        rawKeys.includes(key) ||
        (sChatId && rawKeys.includes(sChatId)) ||
        (sCallerId && rawKeys.includes(sCallerId))
      ) {
        matchedKeys.add(key);
      }
    }

    // Delete matching stacks
    for (const k of matchedKeys) {
      delete this._messageStacks[k];
    }
    saveStoredStacks(this._messageStacks);

    if (this.isNative) {
      try {
        const notifIds = Array.from(matchedKeys).map((k) => ({ id: getNotificationId(k) }));
        if (notifIds.length > 0) {
          await LocalNotifications.cancel({ notifications: notifIds });
        }
      } catch (e) {
        console.warn("[LocalNotifications] clearNotification error:", e);
      }
      try {
        const { registerPlugin } = await import("@capacitor/core");
        const PulseBackground = registerPlugin("PulseBackground");
        for (const k of matchedKeys) {
          PulseBackground.clearNotificationStack({ chatId: k }).catch(() => {});
        }
      } catch {}
    }
  }

  async clearAllNotifications() {
    this._messageStacks = {};
    saveStoredStacks(this._messageStacks);
    if (this.isNative) {
      try {
        if (typeof LocalNotifications.cancelAll === "function") {
          await LocalNotifications.cancelAll();
        }
      } catch (e) {
        console.warn("[LocalNotifications] clearAllNotifications error:", e);
      }
    }
  }
}

export const notificationManager = new UnifiedNotificationManager();
