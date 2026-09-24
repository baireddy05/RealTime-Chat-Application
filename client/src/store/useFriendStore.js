import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";
import { getConversationKey, decryptMessage, isEncryptedMessage } from "../lib/crypto";

export const useFriendStore = create((set, get) => ({
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  searchResults: [],
  isFriendsLoading: false,
  isRequestsLoading: false,
  isSearching: false,

  getFriends: async () => {
    set({ isFriendsLoading: true });
    try {
      const res = await axiosInstance.get("/friends");
      const authUser = useAuthStore.getState().authUser;
      const unreadCounts = { ...useChatStore.getState().unreadCounts };
      const lastMessages = { ...useChatStore.getState().lastMessages };

      const decryptedFriends = await Promise.all(res.data.map(async (f) => {
        if (f.unreadCount !== undefined) {
          unreadCounts[f._id] = f.unreadCount;
        }
        if (f.lastMessage) {
          let lastMsg = f.lastMessage;
          if (lastMsg.isEncrypted || isEncryptedMessage(lastMsg.text)) {
            const key = getConversationKey({ id: f._id, type: "user" }, authUser?._id);
            const dec = await decryptMessage(lastMsg.text, key);
            lastMsg = { ...lastMsg, decryptedText: dec };
          }
          f.lastMessage = lastMsg;
          lastMessages[f._id] = lastMsg;
        }
        return f;
      }));

      // Merge (not overwrite) to avoid racing getUsers/getRooms.
      useChatStore.setState((s) => ({
        lastMessages: { ...s.lastMessages, ...lastMessages },
        unreadCounts: { ...s.unreadCounts, ...unreadCounts },
      }));
      set({ friends: decryptedFriends });
    } catch (error) {
      console.error("Error fetching friends:", error);
    } finally {
      set({ isFriendsLoading: false });
    }
  },

  getFriendRequests: async () => {
    set({ isRequestsLoading: true });
    try {
      const res = await axiosInstance.get("/friends/requests");
      set({
        incomingRequests: res.data.incoming || [],
        outgoingRequests: res.data.outgoing || [],
      });
    } catch (error) {
      console.error("Error fetching friend requests:", error);
    } finally {
      set({ isRequestsLoading: false });
    }
  },

  searchUsers: async (query = "") => {
    // Abort stale searches so slow responses can't overwrite newer results.
    try {
      get()._searchAbort?.abort();
    } catch {}
    const ctrl = new AbortController();
    set({ isSearching: true, _searchAbort: ctrl });
    try {
      const q = String(query || "").trim();
      if (!q) {
        set({ searchResults: [] });
        return;
      }
      const endpoint = `/friends/search?query=${encodeURIComponent(q.slice(0, 50))}`;
      const res = await axiosInstance.get(endpoint, { signal: ctrl.signal });
      if (get()._searchAbort !== ctrl) return;
      set({ searchResults: res.data || [] });
    } catch (error) {
      if (error?.name === "CanceledError" || error?.code === "ERR_CANCELED") return;
      console.error("Error searching users:", error);
    } finally {
      if (get()._searchAbort === ctrl) set({ isSearching: false, _searchAbort: null });
    }
  },

  sendFriendRequest: async (targetUserId) => {
    try {
      const res = await axiosInstance.post(`/friends/request/${targetUserId}`);
      const { searchResults, outgoingRequests } = get();

      // Update search results status
      const updatedResults = searchResults.map((u) =>
        u._id === targetUserId ? { ...u, relationship: "pending_outgoing" } : u
      );

      set({
        searchResults: updatedResults,
        outgoingRequests: [...outgoingRequests, res.data],
      });
      get().getFriendRequests();
      return { success: true };
    } catch (error) {
      console.error("Error sending friend request:", error);
      const msg = error.response?.data?.message || "Failed to send request";
      if (msg.includes("already pending") || msg.includes("already friends")) {
        const { searchResults } = get();
        const updatedResults = searchResults.map((u) =>
          u._id === targetUserId ? { ...u, relationship: msg.includes("already friends") ? "friend" : "pending_outgoing" } : u
        );
        set({ searchResults: updatedResults });
        get().getFriendRequests();
      }
      return { success: false, message: msg };
    }
  },

  acceptFriendRequest: async (requestId) => {
    try {
      const res = await axiosInstance.post(`/friends/accept/${requestId}`);
      const { incomingRequests, friends } = get();

      const acceptedReq = incomingRequests.find((r) => r._id === requestId);
      const newFriend = res.data.friend || acceptedReq?.sender;
      if (!newFriend?._id) {
        // Keep request on failure to add — never silently drop it.
        return { success: false, message: "Could not add friend" };
      }

      // Deduplicate: filter out any existing entry before adding (ObjectId-safe)
      const dedupedFriends = friends.filter((f) => f._id?.toString() !== newFriend?._id?.toString());

      set({
        incomingRequests: incomingRequests.filter((r) => r._id !== requestId),
        friends: newFriend ? [...dedupedFriends, newFriend] : friends,
      });
      return { success: true };
    } catch (error) {
      console.error("Error accepting friend request:", error);
      return { success: false };
    }
  },

  rejectFriendRequest: async (requestId) => {
    try {
      await axiosInstance.post(`/friends/reject/${requestId}`);
      const { incomingRequests, outgoingRequests } = get();
      set({
        incomingRequests: incomingRequests.filter((r) => r._id !== requestId),
        outgoingRequests: outgoingRequests.filter((r) => r._id !== requestId),
      });
      return { success: true };
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      return { success: false };
    }
  },

  removeFriend: async (userId) => {
    try {
      await axiosInstance.delete(`/friends/${userId}`);
      const { friends } = get();
      set({ friends: friends.filter((f) => f._id?.toString() !== userId?.toString()) });
      return { success: true };
    } catch (error) {
      console.error("Error removing friend:", error);
      return { success: false };
    }
  },

  blockedUsers: [],

  getBlockedUsers: async () => {
    try {
      const res = await axiosInstance.get("/friends/blocked");
      set({ blockedUsers: res.data || [] });
      return res.data;
    } catch (error) {
      console.error("Error fetching blocked users:", error);
      return [];
    }
  },

  blockUser: async (userId) => {
    try {
      await axiosInstance.post(`/friends/block/${userId}`);
      const { friends, blockedUsers } = get();
      const target = friends.find((f) => f._id?.toString() === userId?.toString());
      set({
        friends: friends.filter((f) => f._id?.toString() !== userId?.toString()),
        blockedUsers: target && !blockedUsers.some((b) => b._id?.toString() === userId?.toString())
          ? [...blockedUsers, target]
          : blockedUsers,
      });
      // Drop any open chat + cached previews with the blocked user
      try {
        const chatState = useChatStore.getState();
        const idStr = userId?.toString();
        useChatStore.setState({
          users: (chatState.users || []).filter((u) => (u._id || u.id)?.toString() !== idStr),
          lastMessages: Object.fromEntries(
            Object.entries(chatState.lastMessages || {}).filter(([k]) => k !== idStr)
          ),
          unreadCounts: Object.fromEntries(
            Object.entries(chatState.unreadCounts || {}).filter(([k]) => k !== idStr)
          ),
          selectedChat: chatState.selectedChat?.id?.toString() === idStr ? null : chatState.selectedChat,
        });
      } catch {}
      return { success: true };
    } catch (error) {
      console.error("Error blocking user:", error);
      return { success: false, message: error.response?.data?.message || "Failed to block user" };
    }
  },

  unblockUser: async (userId) => {
    try {
      await axiosInstance.delete(`/friends/block/${userId}`);
      const { blockedUsers } = get();
      set({ blockedUsers: blockedUsers.filter((b) => b._id?.toString() !== userId?.toString()) });
      get().getFriends();
      return { success: true };
    } catch (error) {
      console.error("Error unblocking user:", error);
      return { success: false };
    }
  },

  reportUser: async (userId, reason = "") => {
    try {
      await axiosInstance.post(`/friends/report/${userId}`, { reason });
      // Reporting auto-blocks server-side; mirror the local cleanup directly
      // (no second block request needed).
      const { friends, blockedUsers } = get();
      const target = friends.find((f) => f._id?.toString() === userId?.toString());
      const idStr = userId?.toString();
      set({
        friends: friends.filter((f) => f._id?.toString() !== idStr),
        blockedUsers: target && !blockedUsers.some((b) => b._id?.toString() === idStr)
          ? [...blockedUsers, target]
          : blockedUsers,
      });
      try {
        const chatState = useChatStore.getState();
        useChatStore.setState({
          users: (chatState.users || []).filter((u) => (u._id || u.id)?.toString() !== idStr),
          selectedChat: chatState.selectedChat?.id?.toString() === idStr ? null : chatState.selectedChat,
        });
      } catch {}
      return { success: true };
    } catch (error) {
      console.error("Error reporting user:", error);
      return { success: false, message: error.response?.data?.message || "Failed to submit report" };
    }
  },

  subscribeToFriendEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // Track bound socket so a rotation doesn't leak listeners on the old one.
    const prev = get()._friendSocket;
    if (prev && prev !== socket) {
      try {
        prev.off("newFriendRequest");
        prev.off("friendRequestAccepted");
        prev.off("friendRemoved");
        prev.off("userUpdated");
      } catch {}
    }
    set({ _friendSocket: socket });
    get().unsubscribeFromFriendEvents();

    socket.on("newFriendRequest", (request) => {
      const { incomingRequests } = get();
      if (!incomingRequests.some((r) => r._id?.toString() === request._id?.toString())) {
        set({ incomingRequests: [request, ...incomingRequests] });
      }
      // Re-fetch to guarantee complete populated data
      get().getFriendRequests();
    });

    socket.on("friendRequestAccepted", ({ newFriend, requestId }) => {
      const { friends, outgoingRequests, incomingRequests } = get();
      const dedupedFriends = friends.filter((f) => f._id?.toString() !== newFriend?._id?.toString());
      set({
        friends: newFriend ? [...dedupedFriends, newFriend] : friends,
        outgoingRequests: outgoingRequests.filter((r) => r._id?.toString() !== requestId?.toString()),
        incomingRequests: incomingRequests.filter((r) => r._id?.toString() !== requestId?.toString()),
      });
      get().getFriends();
      get().getFriendRequests();
    });

    socket.on("friendRemoved", ({ userId }) => {
      const { friends } = get();
      set({ friends: friends.filter((f) => f._id?.toString() !== userId?.toString()) });
      get().getFriends();
    });

    socket.on("userUpdated", (updatedUser) => {
      if (!updatedUser?._id) return;
      const { friends } = get();
      set({
        friends: friends.map((f) => (f._id?.toString() === updatedUser._id?.toString() ? { ...f, ...updatedUser } : f)),
      });
      const authUser = useAuthStore.getState().authUser;
      if (authUser && authUser._id?.toString() === updatedUser._id?.toString()) {
        useAuthStore.setState({ authUser: { ...authUser, ...updatedUser } });
      }
    });
  },

  unsubscribeFromFriendEvents: () => {
    const socket = get()._friendSocket || useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newFriendRequest");
    socket.off("friendRequestAccepted");
    socket.off("friendRemoved");
    socket.off("userUpdated");
  },
}));
