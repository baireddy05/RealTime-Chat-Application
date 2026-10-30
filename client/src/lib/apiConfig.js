import { Capacitor } from "@capacitor/core";

export const LOCAL_WIFI_API = "http://192.168.1.38:5000/api";
export const PROD_CLOUD_API = "https://pulse-chat-backend-t5tl.onrender.com/api";
const DEFAULT_WEB_API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const getApiBaseUrl = () => {
  try {
    const custom = localStorage.getItem("pulse_custom_server_url");
    if (custom && custom.trim()) {
      let trimmed = custom.trim().replace(/\/$/, "");
      if (!trimmed.endsWith("/api")) trimmed += "/api";
      return trimmed;
    }
  } catch {}

  // On native Android devices: default to local Wi-Fi backend (with verified FCM push active)
  if (Capacitor.isNativePlatform()) {
    return LOCAL_WIFI_API;
  }

  return DEFAULT_WEB_API.replace(/\/$/, "");
};

export const getSocketBaseUrl = () => {
  const apiUrl = getApiBaseUrl();
  try {
    const u = new URL(apiUrl);
    return u.origin;
  } catch {
    return apiUrl.replace(/\/api\/?$/, "") || "http://localhost:5000";
  }
};

export const setCustomServerUrl = (url) => {
  try {
    if (!url || !url.trim()) {
      localStorage.removeItem("pulse_custom_server_url");
    } else {
      localStorage.setItem("pulse_custom_server_url", url.trim());
    }
    window.dispatchEvent(new CustomEvent("pulse:server-changed", { detail: { url } }));
  } catch {}
};
