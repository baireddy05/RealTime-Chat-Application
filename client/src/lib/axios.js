import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true, // Crucial for sending/receiving secure cookies
});

// Automatically attach Authorization header from localStorage if available (handles cross-domain cookie blocks)
axiosInstance.interceptors.request.use((config) => {
  try {
    if (!config) return config;
    config.headers = config.headers || {};
    const token = localStorage.getItem("pulse-token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

// Set once the direct store fallback below has fired, so concurrent 401s
// can't each trigger their own reset cascade.
let unauthorizedFallbackFired = false;

// On 401 (expired/invalid token), clear auth so the app returns to login instead of looping
axiosInstance.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401 && !error.config?._retryAuth) {
      const url = error.config?.url || "";
      // Don't trigger logout loop for auth check, credentials, or password recovery endpoints
      if (
        !url.includes("/auth/check") &&
        !url.includes("/auth/login") &&
        !url.includes("/auth/signup") &&
        !url.includes("/auth/forgot-password") &&
        !url.includes("/auth/verify-otp") &&
        !url.includes("/auth/reset-password")
      ) {
        try {
          localStorage.removeItem("pulse-token");
        } catch {}
        // Primary path: event handled by useAuthStore (avoids a static import
        // cycle). Fallback: if the store module hasn't loaded yet and nobody
        // handles the event, reset it directly after a tick.
        try {
          window.dispatchEvent(new CustomEvent("pulse:unauthorized"));
        } catch {}
        setTimeout(() => {
          if (unauthorizedFallbackFired) return;
          unauthorizedFallbackFired = true;
          import("../store/useAuthStore").then(({ useAuthStore }) => {
            try {
              if (useAuthStore.getState().authUser) {
                useAuthStore.setState({ authUser: null });
                useAuthStore.getState().disconnectSocket?.();
              }
            } catch {}
          }).catch(() => {});
        }, 1500);
      }
    }
    return Promise.reject(error);
  }
);
