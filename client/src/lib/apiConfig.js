import { Capacitor } from "@capacitor/core";

export const LOCAL_WIFI_API = "http://192.168.1.38:5000/api";
export const PROD_CLOUD_API = "https://pulse-chat-backend-t5tl.onrender.com/api";
const DEFAULT_WEB_API = import.meta.env.VITE_API_URL || "https://pulse-chat-backend-t5tl.onrender.com/api";

export const getApiBaseUrl = () => {
  try {
    const custom = localStorage.getItem("pulse_custom_server_url");
    if (custom && custom.trim()) {
      let trimmed = custom.trim().replace(/\/$/, "");
      // Guard: do not let an obsolete hardcoded private LAN IP lock users out
      if (trimmed !== LOCAL_WIFI_API && !trimmed.includes("192.168.1.38")) {
        if (!trimmed.endsWith("/api")) trimmed += "/api";
        return trimmed;
      }
    }
  } catch {}

  // Native Android devices and web production default to the live cloud backend (Render)
  // so friends and users everywhere (Wi-Fi, 4G, 5G) connect reliably.
  if (Capacitor.isNativePlatform()) {
    return PROD_CLOUD_API;
  }

  // Web app: if running in dev environment (localhost) without custom URL, allow local backend
  if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    return (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
  }

  return (DEFAULT_WEB_API || PROD_CLOUD_API).replace(/\/$/, "");
};

export const getSocketBaseUrl = () => {
  const apiUrl = getApiBaseUrl();
  try {
    const u = new URL(apiUrl);
    return u.origin;
  } catch {
    return apiUrl.replace(/\/api\/?$/, "") || PROD_CLOUD_API.replace(/\/api\/?$/, "");
  }
};

export const setCustomServerUrl = (url) => {
  try {
    if (!url || !url.trim() || url.trim() === PROD_CLOUD_API) {
      localStorage.removeItem("pulse_custom_server_url");
    } else {
      let trimmed = url.trim().replace(/\/$/, "");
      if (!trimmed.endsWith("/api")) trimmed += "/api";
      localStorage.setItem("pulse_custom_server_url", trimmed);
    }
    window.dispatchEvent(new CustomEvent("pulse:server-changed", { detail: { url } }));
  } catch {}
};
