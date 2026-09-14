import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
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

      const decryptedFriends = await Promise.all(res.data.map(async (f) => {
        if (f.lastMessage) {
          let lastMsg = f.lastMessage;
          if (lastMsg.isEncrypted || isEncryptedMessage(lastMsg.text)) {
            const key = getConversationKey({ id: f._id, type: "user" }, authUser?._id);
            const dec = await decryptMessage(lastMsg.text, key);
            lastMsg = { ...lastMsg, decryptedText: dec };
          }
          f.lastMessage = lastMsg;
        }
        return f;
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
    set({ isSearching: true });
    try {
      const endpoint = query && query.trim().length > 0
        ? `/friends/search?query=${encodeURIComponent(query.trim())}`
        : `/friends/search`;
      const res = await axiosInstance.get(endpoint);
      set({ searchResults: res.data || [] });
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      set({ isSearching: false });
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

      // Deduplicate: filter out any existing entry before adding
      const dedupedFriends = friends.filter((f) => f._id !== newFriend?._id);

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

  subscribeToFriendEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

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
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newFriendRequest");
    socket.off("friendRequestAccepted");
    socket.off("friendRemoved");
    socket.off("userUpdated");
  },
}));
