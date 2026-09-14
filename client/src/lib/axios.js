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
