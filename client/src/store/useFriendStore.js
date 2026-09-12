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

  searchUsers: async (query) => {
    if (!query || query.trim().length === 0) {
      set({ searchResults: [] });
      return;
    }
    set({ isSearching: true });
    try {
      const res = await axiosInstance.get(`/friends/search?query=${encodeURIComponent(query)}`);
      set({ searchResults: res.data });
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
      return { success: true };
    } catch (error) {
      console.error("Error sending friend request:", error);
      return { success: false, message: error.response?.data?.message || "Failed to send request" };
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
      set({ friends: friends.filter((f) => f._id !== userId) });
      return { success: true };
    } catch (error) {
      console.error("Error removing friend:", error);
      return { success: false };
    }
  },

  subscribeToFriendEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("newFriendRequest", (request) => {
      const { incomingRequests } = get();
      if (!incomingRequests.some((r) => r._id === request._id)) {
        set({ incomingRequests: [request, ...incomingRequests] });
      }
    });

    socket.on("friendRequestAccepted", ({ newFriend, requestId }) => {
      const { friends, outgoingRequests, incomingRequests } = get();
      set({
        friends: [...friends.filter((f) => f._id !== newFriend._id), newFriend],
        outgoingRequests: outgoingRequests.filter((r) => r._id !== requestId),
        incomingRequests: incomingRequests.filter((r) => r._id !== requestId),
      });
    });

    socket.on("friendRemoved", ({ userId }) => {
      const { friends } = get();
      set({ friends: friends.filter((f) => f._id !== userId) });
    });
  },

  unsubscribeFromFriendEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newFriendRequest");
    socket.off("friendRequestAccepted");
    socket.off("friendRemoved");
  },
}));
