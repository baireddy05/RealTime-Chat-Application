import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { io } from "socket.io-client";

const getSocketBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  try {
    const u = new URL(apiUrl);
    // Socket.io server lives at the origin (no /api path)
    return u.origin;
  } catch {
    return apiUrl.replace(/\/api\/?$/, "") || "http://localhost:5000";
  }
};

const BASE_URL = getSocketBaseUrl();

const stripToken = (data) => {
  if (!data || typeof data !== "object") return data;
  const { token, ...user } = data;
  return user;
};

let visibilityHandler = null;

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
      set({ authUser: stripToken(res.data) });
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
      set({ authUser: stripToken(res.data) });
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
      set({ authUser: stripToken(res.data) });
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
    } catch (error) {
      console.error(error.response?.data?.message || "Logout failed");
    } finally {
      localStorage.removeItem("pulse-token");
      set({ authUser: null });
      get().disconnectSocket();
      // Clear chat + call state so next login starts fresh
      try {
        const { useChatStore } = await import("./useChatStore");
        useChatStore.setState({
          selectedChat: null,
          messages: [],
          scheduledMessages: [],
          unreadCounts: {},
          lastMessages: {},
          replyingTo: null,
          editingMessage: null,
          forwardingMessage: null,
          activeThreadMessage: null,
          threadReplies: [],
          isThreadOpen: false,
          unlockedChats: [],
        });
      } catch {}
      try {
        const { useCallStore } = await import("./useCallStore");
        useCallStore.getState().cleanupCall?.();
      } catch {}
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
      set({ onlineUsers: (userIds || []).map((id) => id?.toString()) });
    });

    newSocket.on("connect", () => {
      newSocket.emit("userVisibilityChange", { isHidden: document.hidden });
    });

    if (visibilityHandler) {
      document.removeEventListener("visibilitychange", visibilityHandler);
      window.removeEventListener("focus", visibilityHandler);
    }
    visibilityHandler = () => {
      if (newSocket.connected) {
        newSocket.emit("userVisibilityChange", { isHidden: document.hidden });
      }
      if (!document.hidden) {
        import("./useChatStore").then(({ useChatStore }) => {
          useChatStore.getState().resyncCurrentChat?.();
          useChatStore.getState().getUsers?.();
          useChatStore.getState().getRooms?.();
        }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    window.addEventListener("focus", visibilityHandler);
  },

  disconnectSocket: () => {
    if (get().socket) {
      get().socket.disconnect();
      set({ socket: null, onlineUsers: [] });
    }
    if (visibilityHandler) {
      document.removeEventListener("visibilitychange", visibilityHandler);
      window.removeEventListener("focus", visibilityHandler);
      visibilityHandler = null;
    }
  },
}));

// Global 401 handler (dispatched from lib/axios.js to avoid a static+dynamic import cycle)
if (typeof window !== "undefined") {
  window.addEventListener("pulse:unauthorized", () => {
    try {
      useAuthStore.setState({ authUser: null });
      useAuthStore.getState().disconnectSocket?.();
    } catch {}
  });
}
