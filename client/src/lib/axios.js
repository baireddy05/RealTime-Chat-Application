import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true, // Crucial for sending/receiving secure cookies
});

// Automatically attach Authorization header from localStorage if available (handles cross-domain cookie blocks)
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("pulse-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 (expired/invalid token), clear auth so the app returns to login instead of looping
axiosInstance.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401 && !error.config?._retryAuth) {
      const url = error.config?.url || "";
      // Don't trigger logout loop for the auth check itself
      if (!url.includes("/auth/check") && !url.includes("/auth/login") && !url.includes("/auth/signup")) {
        localStorage.removeItem("pulse-token");
        // Avoid static+dynamic double import of the auth store (vite warning);
        // notify via event and let useAuthStore handle the state reset.
        try {
          window.dispatchEvent(new CustomEvent("pulse:unauthorized"));
        } catch {}
      }
    }
    return Promise.reject(error);
  }
);
