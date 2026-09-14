import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || "http://localhost:5000";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  isLoggingIn: false,
  isSigningUp: false,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      if (res.data.token) {
        localStorage.setItem("pulse-token", res.data.token);
      }
      set({ authUser: res.data });
      get().connectSocket();
    } catch {
      localStorage.removeItem("pulse-token");
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      if (res.data.token) {
        localStorage.setItem("pulse-token", res.data.token);
      }
      set({ authUser: res.data });
      get().connectSocket();
      return true;
    } catch (error) {
      console.error(error.response?.data?.message || "Signup failed");
      throw error;
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      if (res.data.token) {
        localStorage.setItem("pulse-token", res.data.token);
      }
      set({ authUser: res.data });
      get().connectSocket();
      return true;
    } catch (error) {
      console.error(error.response?.data?.message || "Login failed");
      throw error;
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      localStorage.removeItem("pulse-token");
      set({ authUser: null });
      get().disconnectSocket();
    } catch (error) {
      console.error(error.response?.data?.message || "Logout failed");
    }
  },

  updateProfile: async (profileData) => {
    try {
      const res = await axiosInstance.put("/auth/update-profile", profileData);
      set({ authUser: res.data });
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Update profile failed", error);
      return { success: false, message: error.response?.data?.message || "Failed to update profile" };
    }
  },

  connectSocket: () => {
    const { authUser, socket } = get();
    if (!authUser || (socket && socket.connected)) return;

    const token = localStorage.getItem("pulse-token");
    const newSocket = io(BASE_URL, {
      withCredentials: true,
      auth: { token },
    });
    
    newSocket.connect();
    set({ socket: newSocket });

    newSocket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });
  },

  disconnectSocket: () => {
    if (get().socket) {
      get().socket.disconnect();
      set({ socket: null, onlineUsers: [] });
    }
  },
}));
