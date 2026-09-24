import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { useFriendStore } from "./useFriendStore";
import { soundManager } from "../lib/sound";
import { notificationManager } from "../lib/notification";
import {
  encryptMessage,
  decryptMessage,
  isEncryptedMessage,
  getConversationKey,
} from "../lib/crypto";

// Decrypt a single message doc with the key of ITS OWN conversation
// (not the currently open chat) — used for starred messages & reminders.
const decryptMessageDoc = async (m, authUserId) => {
  if (!m || (!m.isEncrypted && !isEncryptedMessage(m.text))) return m;
  try {
    let key = null;
    const roomIdStr = (m.roomId?._id || m.roomId)?.toString();
    if (roomIdStr) {
      key = `pulse-room-key-${roomIdStr}`;
    } else {
      const senderStr = (m.senderId?._id || m.senderId)?.toString();
      const receiverStr = (m.receiverId?._id || m.receiverId)?.toString();
      const otherId = senderStr === String(authUserId) ? receiverStr : senderStr;
      if (otherId) {
        const ids = [String(authUserId), String(otherId)].sort();
        key = `pulse-dm-key-${ids[0]}-${ids[1]}`;
      }
    }
    if (!key) return m;
    const dec = await decryptMessage(m.text, key);
    return { ...m, decryptedText: dec };
  } catch {
    return m;
  }
};

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  rooms: [],
  joinRequestPing: null, // { roomId, at } — nudges GroupInfoModal to refetch requests
  selectedChat: null, // { id: string, type: 'user' | 'room', name: string, members?: [], description?: string }
  typingUsers: {}, // { [chatId]: [username1, username2] }
  isUsersLoading: false,
  isRoomsLoading: false,
  isMessagesLoading: false,
  isSending: false,
  soundMuted: soundManager.isMuted(),
  toggleSound: () => {
    const next = soundManager.toggleMuted();
    set({ soundMuted: next });
  },

  // 8 Enhanced Features state
  unreadCounts: {}, // { [chatId]: number }
  lastMessages: {}, // { [chatId]: messageObj }
  drafts: (() => {
    try {
      return JSON.parse(localStorage.getItem("pulse-chat-drafts") || "{}");
    } catch {
      return {};
    }
  })(), // { [chatId]: string }
  archivedChats: (() => {
    try {
      return JSON.parse(localStorage.getItem("pulse-archived-chats") || "[]");
    } catch {
      return [];
    }
  })(), // [chatId]
  disappearingTimer: null, // null, 5, 60, 3600, 86400 (seconds)
  scheduledMessages: [],
  networkStatuses: [],
  myStatuses: [],
  isScheduledOpen: false,
  isChatThemeOpen: false,
  isSettingsOpen: false,
  // Primary tabs shared by mobile bottom nav and desktop activity rail
  // (Chats / Updates / Groups / Calls). The sidebar pager follows this.
  mobileTab: "chats",
  setMobileTab: (tab) => set({ mobileTab: tab }),
  backgroundAnimationsEnabled: (() => {
    try {
      const v = localStorage.getItem("pulse_bg_animations_enabled");
      return v !== null ? JSON.parse(v) : true;
    } catch {
      return true;
    }
  })(),
  typingShockwavesEnabled: (() => {
    try {
      const v = localStorage.getItem("pulse_typing_shockwaves_enabled");
      return v !== null ? JSON.parse(v) : true;
    } catch {
      return true;
    }
  })(),
  chatThemes: (() => {
    try {
      return JSON.parse(localStorage.getItem("pulse-chat-themes") || "{}");
    } catch {
      return {};
    }
  })(),
  globalChatTheme: (() => {
    try {
      const saved = localStorage.getItem("pulse-global-chat-theme");
      if (saved) {
        return saved.startsWith("{") ? JSON.parse(saved) : saved;
      }
    } catch {}
    return "default";
  })(),

  setDisappearingTimer: (seconds) => set({ disappearingTimer: seconds }),

  // Per-chat default disappearing timer (stored on the user profile).
  // Used when neither the message nor the session timer specifies one.
  getChatDefaultDisappearing: (chatId) => {
    if (!chatId) return null;
    const prefs = useAuthStore.getState().authUser?.chatPreferences?.[chatId];
    const v = prefs?.disappearing;
    return typeof v === "number" && v > 0 ? v : null;
  },

  setChatDisappearing: async (chatId, seconds) => {
    try {
      const res = await axiosInstance.put(`/chat/preferences/${chatId}`, { disappearing: seconds });
      const prefs = res.data?.preferences;
      const authState = useAuthStore.getState();
      if (authState?.authUser) {
        const prev = authState.authUser.chatPreferences || {};
        useAuthStore.setState({
          authUser: {
            ...authState.authUser,
            chatPreferences: { ...prev, [chatId]: { ...(prev[chatId] || {}), disappearing: prefs?.disappearing ?? seconds } },
          },
        });
      }
      return { success: true, preferences: prefs };
    } catch (error) {
      console.error("Error setting chat disappearing default:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  setChatTone: async (chatId, tone) => {
    try {
      const res = await axiosInstance.put(`/chat/preferences/${chatId}`, { tone });
      const prefs = res.data?.preferences;
      const authState = useAuthStore.getState();
      if (authState?.authUser) {
        const prev = authState.authUser.chatPreferences || {};
        useAuthStore.setState({
          authUser: {
            ...authState.authUser,
            chatPreferences: { ...prev, [chatId]: { ...(prev[chatId] || {}), tone: prefs?.tone ?? tone } },
          },
        });
      }
      return { success: true, preferences: prefs };
    } catch (error) {
      console.error("Error setting chat tone:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // ---- Chat lock (PIN gate session state; locks themselves live in localStorage)
  unlockedChats: [],
  unlockChat: (chatId) =>
    set((state) =>
      state.unlockedChats.includes(chatId)
        ? state
        : { unlockedChats: [...state.unlockedChats, chatId] }
    ),
  relockChat: (chatId) =>
    set((state) => ({
      unlockedChats: state.unlockedChats.filter((id) => id !== chatId),
    })),
  setIsScheduledOpen: (val) => set({ isScheduledOpen: val }),
  setIsChatThemeOpen: (val) => set({ isChatThemeOpen: val }),
  setIsSettingsOpen: (val) => set({ isSettingsOpen: val }),
  setBackgroundAnimationsEnabled: (val) => {
    try {
      localStorage.setItem("pulse_bg_animations_enabled", JSON.stringify(val));
    } catch (e) {
      console.error(e);
    }
    set({ backgroundAnimationsEnabled: val });
  },
  setTypingShockwavesEnabled: (val) => {
    try {
      localStorage.setItem("pulse_typing_shockwaves_enabled", JSON.stringify(val));
    } catch (e) {
      console.error(e);
    }
    set({ typingShockwavesEnabled: val });
  },

  setChatTheme: (chatId, themeConfigOrId) => {
    const { chatThemes } = get();
    const updated = { ...chatThemes, [chatId]: themeConfigOrId };
    try {
      localStorage.setItem("pulse-chat-themes", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    set({ chatThemes: updated });
  },

  setGlobalChatTheme: (themeConfigOrId) => {
    try {
      const serialized =
        typeof themeConfigOrId === "object"
          ? JSON.stringify(themeConfigOrId)
          : themeConfigOrId;
      localStorage.setItem("pulse-global-chat-theme", serialized);
    } catch (e) {
      console.error(e);
    }
    set({ globalChatTheme: themeConfigOrId });
  },

  getEffectiveChatTheme: (chatId) => {
    const { chatThemes, globalChatTheme } = get();
    if (chatId && chatThemes[chatId]) {
      return chatThemes[chatId];
    }
    return globalChatTheme || "default";
  },

  // Feature states
  replyingTo: null, // message object { _id, senderId, text, image, file }
  editingMessage: null, // { _id, text }
  forwardingMessage: null, // message object to forward
  starredMessages: [],
  isStarredLoading: false,
  isStarredOpen: false,
  isGroupInfoOpen: false,

  // Feature 4: Slack-style Thread Drawer
  activeThreadMessage: null,
  threadReplies: [],
  isThreadOpen: false,
  isThreadLoading: false,

  // Feature 5: End-to-End Encryption (Default on)
  isE2eeEnabled: true,
  toggleE2ee: () => {},
  setIsE2eeEnabled: () => {},

  openThread: (message) => {
    set({ activeThreadMessage: message, isThreadOpen: true, threadReplies: [] });
    get().getThreadReplies(message._id);
  },
  closeThread: () => {
    set({ activeThreadMessage: null, isThreadOpen: false, threadReplies: [] });
  },

  setReplyingTo: (msg) => set({ replyingTo: msg }),
  setEditingMessage: (msg) => set({ editingMessage: msg }),
  setForwardingMessage: (msg) => set({ forwardingMessage: msg }),
  setIsStarredOpen: (val) => set({ isStarredOpen: val }),
  setIsGroupInfoOpen: (val) => set({ isGroupInfoOpen: val }),

  getStatuses: async () => {
    try {
      const res = await axiosInstance.get("/statuses");
      const authUser = useAuthStore.getState().authUser;
      const allStatuses = res.data;
      
      const myStatuses = allStatuses.filter((s) => (s.userId?._id || s.userId)?.toString() === authUser?._id?.toString());
      
      // Group network statuses by user
      const networkMap = {};
      allStatuses.forEach((s) => {
        const uId = (s.userId?._id || s.userId)?.toString();
        if (!uId || uId === authUser?._id?.toString()) return;
        
        if (!networkMap[uId]) {
          networkMap[uId] = {
            id: uId,
            user: s.userId?.username || "User",
            avatar: s.userId?.profilePic || "",
            stories: [],
          };
        }
        networkMap[uId].stories.push({
          id: s._id,
          time: new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: s.text,
          bg: s.bg,
          mediaUrl: s.mediaUrl || null,
          mediaType: s.mediaType || null,
          viewersCount: (s.viewers || []).length,
        });
      });
      
      set({ 
        myStatuses: myStatuses.map(s => ({
          id: s._id,
          time: new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: s.text,
          bg: s.bg,
          mediaUrl: s.mediaUrl || null,
          mediaType: s.mediaType || null,
          viewersCount: (s.viewers || []).length,
        })),
        networkStatuses: Object.values(networkMap) 
      });
    } catch (error) {
      console.error("Error fetching statuses:", error);
    }
  },

  uploadStatus: async (text, bg, media) => {
    try {
      const res = await axiosInstance.post("/statuses", {
        text,
        bg,
        mediaUrl: media?.mediaUrl || undefined,
        mediaType: media?.mediaType || undefined,
      });
      
      const newStory = {
        id: res.data._id,
        time: new Date(res.data.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: res.data.text,
        bg: res.data.bg,
        mediaUrl: res.data.mediaUrl || null,
        mediaType: res.data.mediaType || null,
        viewersCount: 0,
      };
      
      set((state) => ({
        myStatuses: [newStory, ...state.myStatuses]
      }));
      return res.data;
    } catch (error) {
      console.error("Error uploading status:", error);
      throw error;
    }
  },

  viewStatus: async (statusId) => {
    try {
      const res = await axiosInstance.post(`/statuses/${statusId}/view`);
      return { success: true, viewersCount: res.data?.viewersCount ?? 0 };
    } catch (error) {
      console.error("Error recording status view:", error);
      return { success: false };
    }
  },

  getStatusViewers: async (statusId) => {
    try {
      const res = await axiosInstance.get(`/statuses/${statusId}/viewers`);
      return res.data || [];
    } catch (error) {
      console.error("Error fetching status viewers:", error);
      return [];
    }
  },

  deleteStatus: async (statusId) => {
    try {
      await axiosInstance.delete(`/statuses/${statusId}`);
      set((state) => ({
        myStatuses: state.myStatuses.filter((s) => s.id !== statusId)
      }));
    } catch (error) {
      console.error("Error deleting status:", error);
      throw error;
    }
  },

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/chat/users");
      const unread = { ...get().unreadCounts };
      const last = { ...get().lastMessages };
      const authUser = useAuthStore.getState().authUser;

      await Promise.all(res.data.map(async (u) => {
        if (u.unreadCount !== undefined) unread[u._id] = u.unreadCount;
        if (u.lastMessage) {
          let lastMsg = u.lastMessage;
          if (lastMsg.isEncrypted || isEncryptedMessage(lastMsg.text)) {
            const key = getConversationKey({ id: u._id, type: "user" }, authUser?._id);
            const dec = await decryptMessage(lastMsg.text, key);
            lastMsg = { ...lastMsg, decryptedText: dec };
          }
          last[u._id] = lastMsg;
        }
      }));
      set({ users: res.data, unreadCounts: unread, lastMessages: last });
    } catch (error) {
      console.error(error);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  setDraft: (chatId, text) => {
    set((state) => {
      const newDrafts = { ...state.drafts };
      if (!text || text.trim() === "") {
        delete newDrafts[chatId];
      } else {
        newDrafts[chatId] = text;
      }
      try {
        localStorage.setItem("pulse-chat-drafts", JSON.stringify(newDrafts));
      } catch (e) {
        console.error("Failed to save draft", e);
      }
      return { drafts: newDrafts };
    });
  },

  toggleArchiveChat: async (chatId) => {
    try {
      await axiosInstance.post(`/chat/archive/${chatId}`);
      set((state) => {
        let newArchived = [...state.archivedChats];
        if (newArchived.includes(chatId)) {
          newArchived = newArchived.filter((id) => id !== chatId);
        } else {
          newArchived.push(chatId);
        }
        try {
          localStorage.setItem("pulse-archived-chats", JSON.stringify(newArchived));
        } catch {}
        return { archivedChats: newArchived };
      });
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  },

  togglePinChat: async (chatId) => {
    try {
      const res = await axiosInstance.post(`/chat/pin/${chatId}`);
      const pinnedChats = res.data?.pinnedChats || [];
      const authState = useAuthStore.getState();
      if (authState?.authUser) {
        useAuthStore.setState({
          authUser: { ...authState.authUser, pinnedChats },
        });
      }
      return { success: true, pinned: !!res.data?.pinned, pinnedChats };
    } catch (error) {
      console.error("Error pinning chat:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  getRooms: async () => {
    set({ isRoomsLoading: true });
    try {
      const res = await axiosInstance.get("/chat/rooms");
      const unread = { ...get().unreadCounts };
      const last = { ...get().lastMessages };
      const authUser = useAuthStore.getState().authUser;

      await Promise.all(res.data.map(async (r) => {
        if (r.unreadCount !== undefined) unread[r._id] = r.unreadCount;
        if (r.lastMessage) {
          let lastMsg = r.lastMessage;
          if (lastMsg.isEncrypted || isEncryptedMessage(lastMsg.text)) {
            const key = getConversationKey({ id: r._id, type: "room" }, authUser?._id);
            const dec = await decryptMessage(lastMsg.text, key);
            lastMsg = { ...lastMsg, decryptedText: dec };
          }
          last[r._id] = lastMsg;
        }
      }));
      set({ rooms: res.data, unreadCounts: unread, lastMessages: last });
    } catch (error) {
      console.error(error);
    } finally {
      set({ isRoomsLoading: false });
    }
  },

  createRoom: async ({ name, description, memberIds }) => {
    try {
      const res = await axiosInstance.post("/chat/rooms", {
        name,
        description,
        memberIds,
      });
      const newRoom = res.data;
      const { rooms } = get();
      if (!rooms.some((r) => r._id === newRoom._id)) {
        set({ rooms: [newRoom, ...rooms] });
      }
      return { success: true, room: newRoom };
    } catch (error) {
      console.error("Error creating room:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  getMessages: async (chatId, type) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/chat/${chatId}?type=${type}`);
      const authUser = useAuthStore.getState().authUser;
      // Decrypt with the requested conversation's key — not selectedChat (avoids
      // wrong-key flash on fast chat switches).
      const key = getConversationKey({ id: chatId, type }, authUser?._id);

      const decryptedMessages = await Promise.all(
        res.data.map(async (m) => {
          let msg = m;
          if (m.isEncrypted || isEncryptedMessage(m.text)) {
            const dec = await decryptMessage(m.text, key);
            msg = { ...msg, decryptedText: dec };
          }
          // Also decrypt the reply-to text if it looks encrypted
          if (msg.replyTo?.text && isEncryptedMessage(msg.replyTo.text)) {
            try {
              const decReply = await decryptMessage(msg.replyTo.text, key);
              msg = { ...msg, replyTo: { ...msg.replyTo, decryptedText: decReply } };
            } catch {}
          }
          return msg;
        })
      );

      set({ messages: decryptedMessages });
      get().markMessagesAsRead(chatId, type);
    } catch (error) {
      console.error(error);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  resyncCurrentChat: async () => {
    const { selectedChat, isSending } = get();
    if (!selectedChat || isSending) return;
    try {
      const authUser = useAuthStore.getState().authUser;
      const res = await axiosInstance.get(`/chat/${selectedChat.id}?type=${selectedChat.type}`);
      const key = getConversationKey(selectedChat, authUser?._id);

      const decryptedMessages = await Promise.all(
        res.data.map(async (m) => {
          let msg = m;
          if (m.isEncrypted || isEncryptedMessage(m.text)) {
            const dec = await decryptMessage(m.text, key);
            msg = { ...msg, decryptedText: dec };
          }
          if (msg.replyTo?.text && isEncryptedMessage(msg.replyTo.text)) {
            try {
              const decReply = await decryptMessage(msg.replyTo.text, key);
              msg = { ...msg, replyTo: { ...msg.replyTo, decryptedText: decReply } };
            } catch {}
          }
          return msg;
        })
      );

      set((state) => {
        const currentIds = new Set(state.messages.map((m) => m._id));
        const hasNew = decryptedMessages.some((m) => !currentIds.has(m._id));
        const nonOptimisticCount = state.messages.filter((m) => !m.isOptimistic).length;
        if (hasNew || nonOptimisticCount !== decryptedMessages.length) {
          const serverIds = new Set(decryptedMessages.map((m) => m._id));
          // Drop optimistic twins already acked by server (match by tempId or text+sender+time window is overkill;
          // server echo carries same _id, and socket insert already strips optimistics).
          const optimistic = state.messages.filter((m) => m.isOptimistic && !serverIds.has(m._id) && !serverIds.has(m.tempId));
          return {
            messages: [...decryptedMessages, ...optimistic],
          };
        }
        return state;
      });
    } catch (err) {
      console.error("Error in resyncCurrentChat:", err.message);
    }
  },

  getThreadReplies: async (messageId) => {
    set({ isThreadLoading: true });
    try {
      const res = await axiosInstance.get(`/chat/thread/${messageId}`);
      const authUser = useAuthStore.getState().authUser;
      const key = getConversationKey(get().selectedChat, authUser?._id);

      const decryptedReplies = await Promise.all(
        res.data.map(async (reply) => {
          if (reply.isEncrypted || isEncryptedMessage(reply.text)) {
            const dec = await decryptMessage(reply.text, key);
            return { ...reply, decryptedText: dec };
          }
          return reply;
        })
      );

      set({ threadReplies: decryptedReplies });
    } catch (error) {
      console.error("Error fetching thread replies:", error);
    } finally {
      set({ isThreadLoading: false });
    }
  },

  sendThreadReply: async (replyData) => {
    const { activeThreadMessage, selectedChat } = get();
    if (!activeThreadMessage || !selectedChat) return { success: false };

    try {
      const authUser = useAuthStore.getState().authUser;
      let textToSend = replyData.text || "";
      const originalText = textToSend;
      let isEncrypted = false;

      // Encrypt all outgoing message text by default
      if (textToSend) {
        const key = getConversationKey(selectedChat, authUser?._id);
        textToSend = await encryptMessage(textToSend, key);
        isEncrypted = isEncryptedMessage(textToSend);
      }

      const payload = {
        ...replyData,
        text: textToSend,
        isEncrypted,
        parentMessageId: activeThreadMessage._id,
      };

      if (selectedChat.type === "room") {
        payload.roomId = selectedChat.id;
      }

      const endpoint = `/chat/send/${selectedChat.type === "user" ? selectedChat.id : ""}`;
      const res = await axiosInstance.post(endpoint, payload);
      const returnedMessage = {
        ...res.data,
        decryptedText: originalText,
      };

      set((state) => {
        const exists = state.threadReplies.some((r) => r._id === returnedMessage._id);
        return {
          threadReplies: exists ? state.threadReplies : [...state.threadReplies, returnedMessage],
          activeThreadMessage: {
            ...state.activeThreadMessage,
            threadCount: (state.activeThreadMessage.threadCount || 0) + 1,
            threadLastReply: new Date(),
          },
          messages: state.messages.map((m) =>
            m._id === activeThreadMessage._id
              ? {
                  ...m,
                  threadCount: (m.threadCount || 0) + 1,
                  threadLastReply: new Date(),
                }
              : m
          ),
        };
      });

      soundManager.playSendSound();
      return { success: true, data: returnedMessage };
    } catch (error) {
      console.error("Error sending thread reply:", error);
      return { success: false, error: error.message };
    }
  },

  markMessagesAsRead: async (chatId, type) => {
    if (!chatId) return;
    const prevUnread = get().unreadCounts?.[chatId];
    const prevRooms = get().rooms;
    const prevFriends = useFriendStore.getState()?.friends;
    try {
      set((state) => ({
        unreadCounts: {
          ...state.unreadCounts,
          [chatId]: 0,
        },
        rooms: (state.rooms || []).map((r) => ((r._id || r.id)?.toString() === chatId?.toString() ? { ...r, unreadCount: 0 } : r)),
      }));

      const friendStore = useFriendStore.getState();
      if (friendStore?.friends) {
        useFriendStore.setState({
          friends: friendStore.friends.map((f) => ((f._id || f.id)?.toString() === chatId?.toString() ? { ...f, unreadCount: 0 } : f)),
        });
      }

      await axiosInstance.post(`/chat/${chatId}/read?type=${type}`);
    } catch (error) {
      console.error("Error marking messages as read:", error);
      // Restore badge on failure so unread isn't silently lost.
      try {
        set((state) => ({
          unreadCounts: { ...state.unreadCounts, [chatId]: prevUnread ?? state.unreadCounts?.[chatId] ?? 0 },
          rooms: prevRooms ?? state.rooms,
        }));
        if (prevFriends) useFriendStore.setState({ friends: prevFriends });
      } catch {}
    }
  },

  reactToMessage: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.post(`/chat/${messageId}/react`, { emoji });
      const { messages } = get();
      const updatedMessages = messages.map((m) =>
        m._id === messageId ? { ...m, reactions: res.data.reactions } : m
      );
      set({ messages: updatedMessages });
    } catch (error) {
      console.error("Error reacting to message:", error);
    }
  },

  votePoll: async (messageId, optionIndex) => {
    try {
      const res = await axiosInstance.post(`/chat/${messageId}/vote`, { optionIndex });
      const { messages } = get();
      const updatedMessages = messages.map((m) =>
        m._id === messageId ? { ...m, poll: res.data.poll } : m
      );
      set({ messages: updatedMessages });
    } catch (error) {
      console.error("Error voting on poll:", error);
    }
  },

  viewWhisper: async (messageId) => {
    try {
      await axiosInstance.post(`/chat/${messageId}/whisper`);
    } catch (error) {
      console.error("Error viewing whisper:", error);
    }
  },

  // Open a view-once photo/voice note. Returns the one-time content URL.
  viewOnceMedia: async (messageId) => {
    try {
      const res = await axiosInstance.post(`/chat/message/${messageId}/view-once`);
      return { success: true, ...res.data };
    } catch (error) {
      if (error.response?.status === 410) {
        // Already opened/gone: reflect the consumed state locally too
        const { messages } = get();
        const idStr = messageId?.toString();
        set({
          messages: messages.map((m) =>
            (m._id || m.id)?.toString() === idStr
              ? { ...m, image: null, audio: null, viewOnceOpened: true }
              : m
          ),
        });
        return { success: false, gone: true, error: error.response?.data?.error };
      }
      console.error("Error opening view-once media:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  sendMessage: async (messageData) => {
    const { selectedChat, replyingTo, disappearingTimer } = get();
    if (!selectedChat) return { success: false, error: "No chat selected" };
    const sendKey = `sending:${selectedChat.type}:${selectedChat.id}`;
    if (get()[sendKey]) return { success: false, error: "Already sending" };

    set({ isSending: true, [sendKey]: true });
    // Snapshot last message for accurate rollback (not derived from post-optimistic list).
    const prevLastMessage = get().lastMessages?.[selectedChat.id] ?? null;
    const authUser = useAuthStore.getState().authUser;
    if (!authUser?._id) {
      set({ isSending: false, [sendKey]: false });
      return { success: false, error: "Not authenticated" };
    }
    let textToSend = messageData.text || "";
    const originalText = textToSend;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      let isEncrypted = false;

      // Encrypt all outgoing message text by default
      if (textToSend) {
        const key = getConversationKey(selectedChat, authUser?._id);
        textToSend = await encryptMessage(textToSend, key);
        isEncrypted = isEncryptedMessage(textToSend);
      }

      const payload = {
        ...messageData,
        text: textToSend,
        isEncrypted,
        expiresIn: messageData.expiresIn !== undefined
          ? messageData.expiresIn
          : (disappearingTimer || get().getChatDefaultDisappearing(selectedChat?.id) || undefined),
        replyTo: messageData.replyTo !== undefined ? messageData.replyTo : (replyingTo ? {
          messageId: replyingTo._id,
          senderName: replyingTo.senderId?.username || replyingTo.senderName || "User",
          text: replyingTo.decryptedText || replyingTo.text || (replyingTo.image ? "📷 Photo" : replyingTo.file ? `📎️ ${replyingTo.file.name}` : replyingTo.contact ? `👤 Contact: ${replyingTo.contact.fullName || replyingTo.contact.username || "Contact"}` : "Attachment"),
          image: replyingTo.image || null,
          file: replyingTo.file || null,
          contact: replyingTo.contact || null,
        } : null),
      };

      if (selectedChat.type === "room") {
        payload.roomId = selectedChat.id;
      }

      // Optimistic Message: Immediately add to chat stream for smooth zero-latency transition
      if (!messageData.scheduledFor) {
        const optimisticMsg = {
          _id: tempId,
          tempId,
          text: textToSend,
          decryptedText: originalText,
          senderId: {
            _id: authUser?._id,
            username: authUser?.username || "You",
            profilePic: authUser?.profilePic,
          },
          image: messageData.image || null,
          file: messageData.file || null,
          audio: messageData.audio || null,
          contact: messageData.contact || null,
          isSticker: Boolean(messageData.isSticker),
          createdAt: new Date().toISOString(),
          replyTo: payload.replyTo || null,
          isOptimistic: true,
          status: "sending",
          reactions: [],
        };

        set((state) => ({
          messages: [...state.messages, optimisticMsg],
          lastMessages: {
            ...state.lastMessages,
            [selectedChat.id]: optimisticMsg,
          },
          replyingTo: null,
        }));
        soundManager.playSendSound();
        window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
      }
        
      const endpoint = `/chat/send/${selectedChat.type === "user" ? selectedChat.id : ""}`;
      const res = await axiosInstance.post(endpoint, payload);

      const msgDataWithDecrypted = {
        ...res.data,
        decryptedText: originalText,
      };

      if (res.data.isScheduled) {
        set((state) => ({
          messages: state.messages.filter((m) => m._id !== tempId),
          scheduledMessages: [...state.scheduledMessages, msgDataWithDecrypted],
          replyingTo: null,
        }));
      } else {
        set((state) => {
          // Remove the optimistic message completely
          const withoutOptimistic = state.messages.filter(
            (m) => m._id !== tempId && m.tempId !== tempId
          );
          // Check if the socket already added the real message
          const alreadyExists = withoutOptimistic.some(
            (m) => m._id === msgDataWithDecrypted._id
          );
          return {
            messages: alreadyExists
              ? withoutOptimistic
              : [...withoutOptimistic, msgDataWithDecrypted],
            lastMessages: {
              ...state.lastMessages,
              [selectedChat.id]: msgDataWithDecrypted,
            },
            replyingTo: null,
          };
        });
      }
      return { success: true, data: msgDataWithDecrypted };
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove optimistic placeholder on failure and restore snapshotted last message
      set((state) => {
        const remaining = state.messages.filter((m) => m._id !== tempId);
        return {
          messages: remaining,
          lastMessages: {
            ...state.lastMessages,
            [selectedChat.id]: prevLastMessage,
          },
        };
      });
      return { success: false, error: error.message };
    } finally {
      set({ isSending: false, [sendKey]: false });
    }
  },

  editMessage: async (messageId, text) => {
    try {
      const { selectedChat, messages, editingMessage } = get();
      const authUser = useAuthStore.getState().authUser;
      let textToSend = text;
      if (textToSend) {
        const key = getConversationKey(selectedChat, authUser?._id);
        textToSend = await encryptMessage(textToSend, key);
      }
      const res = await axiosInstance.put(`/chat/message/${messageId}`, { text: textToSend });
      const updated = messages.map((m) =>
        m._id === messageId ? { ...m, text: res.data.text, decryptedText: text, isEdited: true, updatedAt: res.data.updatedAt } : m
      );
      set({
        messages: updated,
        editingMessage: editingMessage?._id === messageId ? null : editingMessage,
      });
      return { success: true };
    } catch (error) {
      console.error("Error editing message:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  toggleStarMessage: async (messageId) => {
    try {
      const res = await axiosInstance.post(`/chat/message/${messageId}/star`);
      const { isStarred } = res.data;
      const authUser = useAuthStore.getState().authUser;
      const myId = authUser?._id;

      const { messages, starredMessages } = get();
      const updatedMessages = messages.map((m) => {
        if (m._id === messageId) {
          const currentStars = m.starredBy || [];
          const newStars = isStarred
            ? [...currentStars, myId]
            : currentStars.filter((id) => (id?._id || id) !== myId);
          return { ...m, starredBy: newStars };
        }
        return m;
      });

      let updatedStarred = starredMessages;
      if (!isStarred) {
        updatedStarred = starredMessages.filter((m) => m._id !== messageId);
      } else {
        const targetMsg = messages.find((m) => m._id === messageId);
        if (targetMsg && !starredMessages.some((m) => m._id === messageId)) {
          updatedStarred = [targetMsg, ...starredMessages];
        }
      }

      set({ messages: updatedMessages, starredMessages: updatedStarred });
      return { success: true, isStarred };
    } catch (error) {
      console.error("Error toggling star:", error);
      return { success: false };
    }
  },

  getStarredMessages: async (chatId = "all", type = "") => {
    set({ isStarredLoading: true });
    try {
      const url = chatId && chatId !== "all" ? `/chat/starred/${chatId}?type=${type || ""}` : "/chat/starred/all";
      const res = await axiosInstance.get(url);
      const authUser = useAuthStore.getState().authUser;

      const decryptedMessages = await Promise.all(
        res.data.map((m) => decryptMessageDoc(m, authUser?._id))
      );

      set({ starredMessages: decryptedMessages });
    } catch (error) {
      console.error("Error fetching starred messages:", error);
    } finally {
      set({ isStarredLoading: false });
    }
  },

  reminders: [],
  isRemindersLoading: false,

  getReminders: async () => {
    set({ isRemindersLoading: true });
    try {
      const res = await axiosInstance.get("/chat/reminders");
      const authUser = useAuthStore.getState().authUser;
      const decrypted = await Promise.all(
        (res.data || []).map(async (r) => {
          if (!r.messageId) return r;
          const msg = await decryptMessageDoc(r.messageId, authUser?._id);
          const preview =
            msg.decryptedText ||
            (isEncryptedMessage(msg.text) ? "🔒 Encrypted Message" : msg.text) ||
            (msg.image ? "📷 Photo" : msg.file ? `📎️ ${msg.file.name}` : msg.audio ? "🎤 Voice Note" : "Message");
          return { ...r, messageId: msg, preview };
        })
      );
      set({ reminders: decrypted });
      return decrypted;
    } catch (error) {
      console.error("Error fetching reminders:", error);
      return [];
    } finally {
      set({ isRemindersLoading: false });
    }
  },

  createReminder: async (messageId, remindAt, note) => {
    try {
      const res = await axiosInstance.post("/chat/reminders", { messageId, remindAt, note });
      get().getReminders();
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error creating reminder:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  cancelReminder: async (reminderId) => {
    try {
      await axiosInstance.delete(`/chat/reminders/${reminderId}`);
      set((state) => ({
        reminders: state.reminders.filter((r) => r._id !== reminderId),
      }));
      return { success: true };
    } catch (error) {
      console.error("Error cancelling reminder:", error);
      return { success: false };
    }
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // Remove any existing listeners first to prevent duplicates
    // (React StrictMode double-mounts effects in dev mode)
    // NOTE: do NOT off("connect") here — that would remove the
    // useAuthStore presence handler. Use a namespaced handler instead.
    socket.off("newMessage");
    socket.off("threadUpdated");
    socket.off("messageExpired");
    socket.off("messageEdited");
    socket.off("roomUpdated");
    socket.off("newRoom");
    socket.off("joinRequestReceived");
    socket.off("messageReaction");
    socket.off("userTyping");
    socket.off("userStoppedTyping");
    socket.off("messagesRead");
    socket.off("messageDeleted");
    socket.off("viewOnceConsumed");
    socket.off("messagePinned");
    socket.off("roomDeleted");
    socket.off("locationUpdated");
    socket.off("pollUpdated");
    socket.off("newStatus");
    socket.off("deletedStatus");
    socket.off("messageDelivered");
    socket.off("reminderDue");
    socket.off("eventCreated");
    socket.off("eventUpdated");
    socket.off("eventDeleted");
    socket.off("eventRsvp");
    socket.off("taskCreated");
    socket.off("taskUpdated");
    socket.off("taskDeleted");
    socket.off("chat:reconnect-resync");

    const { selectedChat } = get();
    // Join room if it's a room chat
    if (selectedChat?.type === "room") {
      socket.emit("joinRoom", selectedChat.id);
    }

    // Auto-resync active chat and metadata on reconnect (namespaced to avoid clobbering auth handler)
    try {
      const prev = socket._chatReconnectHandler;
      if (prev) socket.off("connect", prev);
    } catch {}
    const handleReconnectResync = () => {
      get().resyncCurrentChat();
      get().getUsers();
      get().getRooms();
      const current = get().selectedChat;
      if (current?.type === "room") {
        socket.emit("joinRoom", current.id);
      }
    };
    socket.on("connect", handleReconnectResync);
    // Tag handler so unsubscribe can remove only ours
    try {
      socket._chatReconnectHandler = handleReconnectResync;
    } catch {}

    socket.on("newMessage", async (newMessage) => {
      const { selectedChat } = get();
      const myId = useAuthStore.getState().authUser?._id;
      const myIdStr = myId?.toString();
      const senderIdStr = (newMessage.senderId?._id || newMessage.senderId)?.toString();
      const receiverIdStr = (newMessage.receiverId?._id || newMessage.receiverId)?.toString();
      const isMyMessage = senderIdStr === myIdStr;
      const chatId = newMessage.roomId || (isMyMessage ? receiverIdStr : senderIdStr);

      let processedMessage = newMessage;
      if (processedMessage.isEncrypted || isEncryptedMessage(processedMessage.text)) {
        let key;
        if (newMessage.roomId) {
          key = `pulse-room-key-${newMessage.roomId}`;
        } else {
          const otherId = isMyMessage ? receiverIdStr : senderIdStr;
          const ids = [String(myIdStr), String(otherId)].sort();
          key = `pulse-dm-key-${ids[0]}-${ids[1]}`;
        }
        const dec = await decryptMessage(processedMessage.text, key);
        processedMessage = { ...processedMessage, decryptedText: dec };
      }

      // Always update last message in store so sidebar re-sorts & shows preview
      set((state) => {
        let newUsers = state.users || [];
        const otherUserObj = isMyMessage ? newMessage.receiverId : newMessage.senderId;
        
        if (otherUserObj && typeof otherUserObj === 'object' && otherUserObj._id) {
          if (!newUsers.some((u) => u._id === otherUserObj._id)) {
            newUsers = [...newUsers, { ...otherUserObj, id: otherUserObj._id }];
          }
        }

        return {
          lastMessages: {
            ...state.lastMessages,
            [chatId]: processedMessage,
          },
          users: newUsers,
        };
      });

      const isRoomMsg = selectedChat?.type === "room" && processedMessage.roomId?.toString() === selectedChat.id?.toString();
      const isUserMsg = selectedChat?.type === "user" && 
        (senderIdStr === selectedChat.id?.toString() || receiverIdStr === selectedChat.id?.toString());

      if (isRoomMsg || isUserMsg) {
        set((state) => {
          const exists = state.messages.some((m) => m._id === processedMessage._id);
          if (exists) return state;

          let currentMessages = state.messages;
          if (isMyMessage) {
            currentMessages = currentMessages.filter((m) => !m.isOptimistic);
          }

          return {
            messages: [...currentMessages, processedMessage],
            scheduledMessages: state.scheduledMessages.filter((m) => m._id !== processedMessage._id),
          };
        });
        get().markMessagesAsRead(selectedChat.id, selectedChat.type);

        if (!isMyMessage) {
          const socket = useAuthStore.getState().socket;
          if (socket) {
            socket.emit("messageDelivered", {
              messageId: processedMessage._id,
              senderId: processedMessage.senderId?._id || processedMessage.senderId
            });
          }
          soundManager.playReceiveSound(
            useAuthStore.getState().authUser?.chatPreferences?.[selectedChat.id]?.tone
          );
          const senderName = processedMessage.senderId?.username || "Pulse User";
          const title = selectedChat.type === "room"
            ? `${selectedChat.name} • ${senderName}`
            : senderName;
          const body = processedMessage.decryptedText || processedMessage.text || (processedMessage.image ? "📷 Photo" : processedMessage.file ? `📎️ ${processedMessage.file.name}` : processedMessage.audio ? "🎤 Voice Note" : "New message");
          const myUsername = useAuthStore.getState().authUser?.username || "";
          const mentioned =
            selectedChat.type === "room" &&
            !!myUsername &&
            new RegExp(`@${myUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
              typeof body === "string" ? body : ""
            );
          notificationManager.sendNotification({
            title: mentioned ? `${senderName} mentioned you in ${selectedChat.name}` : title,
            body,
            icon: processedMessage.senderId?.profilePic || "/favicon.png",
          });
          window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
        } else {
          soundManager.playSendSound();
          window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
        }
      } else {
        // Increment unread count for the non-active chat (e.g. mobile chats list view)
        if (!isMyMessage) {
          const socket = useAuthStore.getState().socket;
          if (socket) {
            socket.emit("messageDelivered", {
              messageId: processedMessage._id,
              senderId: processedMessage.senderId?._id || processedMessage.senderId
            });
          }
          set((state) => ({
            unreadCounts: {
              ...state.unreadCounts,
              [chatId]: (state.unreadCounts[chatId] || 0) + 1,
            },
          }));
          soundManager.playReceiveSound(
            useAuthStore.getState().authUser?.chatPreferences?.[chatId]?.tone
          );
          const senderName = processedMessage.senderId?.username || "Pulse User";
          const title = newMessage.roomId ? "New Group Message" : senderName;
          const body = processedMessage.decryptedText || processedMessage.text || (processedMessage.image ? "📷 Photo" : processedMessage.file ? `📎️ ${processedMessage.file.name}` : processedMessage.audio ? "🎤 Voice Note" : "New message");
          const myUsername = useAuthStore.getState().authUser?.username || "";
          const mentioned =
            !!newMessage.roomId &&
            !!myUsername &&
            new RegExp(`@${myUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
              typeof body === "string" ? body : ""
            );
          notificationManager.sendNotification({
            title: mentioned ? `${senderName} mentioned you` : title,
            body,
            icon: processedMessage.senderId?.profilePic || "/favicon.png",
          });
        }
      }
    });

    // Real-time thread updates
    socket.on("threadUpdated", async ({ parentMessageId, threadCount, threadLastReply, newReply }) => {
      const { messages, activeThreadMessage, selectedChat } = get();
      const myId = useAuthStore.getState().authUser?._id;

      // Update parent message in chat feed
      set({
        messages: messages.map((m) =>
          m._id === parentMessageId ? { ...m, threadCount, threadLastReply } : m
        ),
      });

      // If active thread drawer is open for this parent message
      if (activeThreadMessage && activeThreadMessage._id === parentMessageId) {
        let processedReply = newReply;
        if (processedReply && (processedReply.isEncrypted || isEncryptedMessage(processedReply.text))) {
          const key = getConversationKey(selectedChat, myId);
          const dec = await decryptMessage(processedReply.text, key);
          processedReply = { ...processedReply, decryptedText: dec };
        }

        set((state) => {
          const exists = processedReply && state.threadReplies.some((r) => r._id === processedReply._id);
          return {
            activeThreadMessage: {
              ...state.activeThreadMessage,
              threadCount,
              threadLastReply,
            },
            threadReplies: (processedReply && !exists)
              ? [...state.threadReplies, processedReply]
              : state.threadReplies,
          };
        });

        if (newReply && (newReply.senderId?._id || newReply.senderId) !== myId) {
          soundManager.playReceiveSound();
        }
      }
    });

    // Real-time message expiration (self-destruct)
    socket.on("messageExpired", ({ messageId }) => {
      const { messages } = get();
      const updated = messages.map((m) =>
        m._id === messageId
          ? { ...m, isDeleted: true, text: "This message has expired and self-destructed", image: null, audio: null, file: null, reactions: [] }
          : m
      );
      set({ messages: updated });
    });

    // Real-time status updates
    socket.on("newStatus", (status) => {
      const authUser = useAuthStore.getState().authUser;
      const uId = (status.userId?._id || status.userId)?.toString();
      if (!uId || uId === authUser?._id?.toString()) return;

      set((state) => {
        let networkMap = [...state.networkStatuses];
        const personIndex = networkMap.findIndex((p) => p.id?.toString() === uId);
        
        const newStory = {
          id: status._id,
          time: new Date(status.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: status.text,
          bg: status.bg,
          mediaUrl: status.mediaUrl || null,
          mediaType: status.mediaType || null,
          viewersCount: (status.viewers || []).length,
        };

        if (personIndex >= 0) {
          networkMap[personIndex].stories.push(newStory);
        } else {
          networkMap.push({
            id: uId,
            user: status.userId?.username || "User",
            avatar: status.userId?.profilePic || "",
            stories: [newStory],
          });
        }
        return { networkStatuses: networkMap };
      });
    });

    socket.on("deletedStatus", ({ statusId, userId }) => {
      set((state) => {
        return {
          networkStatuses: state.networkStatuses.map((person) => {
            if (person.id === userId) {
              return {
                ...person,
                stories: person.stories.filter((s) => s.id !== statusId),
              };
            }
            return person;
          }).filter(person => person.stories.length > 0)
        };
      });
    });

    // Message reminder fired by the server scheduler
    socket.on("reminderDue", async ({ reminder }) => {
      soundManager.playReceiveSound();
      get().getReminders();
      if (reminder) {
        const myId = useAuthStore.getState().authUser?._id;
        const msg = reminder.messageId && typeof reminder.messageId === "object"
          ? await decryptMessageDoc(reminder.messageId, myId)
          : null;
        const preview = msg
          ? msg.decryptedText ||
            (isEncryptedMessage(msg.text) ? "Message" : msg.text) ||
            (msg.image ? "📷 Photo" : msg.file ? `📎️ ${msg.file.name}` : "Message")
          : "You asked to be reminded about a message";
        notificationManager.sendNotification({
          title: "⏰ Message reminder",
          body: String(preview).slice(0, 120),
          icon: "/favicon.png",
        });
        window.dispatchEvent(new CustomEvent("pulse:scroll-to-bottom"));
      }
    });

    // Real-time message edited
    socket.on("messageEdited", async (payload) => {
      const { selectedChat, messages, threadReplies } = get();
      const myId = useAuthStore.getState().authUser?._id;
      let textDecrypted = payload.text;
      if (isEncryptedMessage(payload.text)) {
        const key = getConversationKey(selectedChat, myId);
        textDecrypted = await decryptMessage(payload.text, key);
      }
      set({
        messages: messages.map((m) =>
          m._id === payload.messageId
            ? { ...m, text: payload.text, decryptedText: textDecrypted, isEdited: true, updatedAt: payload.updatedAt }
            : m
        ),
        threadReplies: threadReplies.map((r) =>
          r._id === payload.messageId
            ? { ...r, text: payload.text, decryptedText: textDecrypted, isEdited: true, updatedAt: payload.updatedAt }
            : r
        ),
      });
    });

    // Real-time room updates (name, avatar, description, members, admins)
    socket.on("roomUpdated", (updatedRoom) => {
      if (!updatedRoom?._id) return;
      const { rooms, channels, selectedChat } = get();
      const myId = useAuthStore.getState().authUser?._id?.toString();
      const stillMember = (updatedRoom.members || []).some(
        (m) => (m?._id || m)?.toString() === myId
      );
      const idStr = updatedRoom._id?.toString();
      const list = updatedRoom.isChannel ? channels : rooms;
      const setList = (next) =>
        updatedRoom.isChannel ? set({ channels: next }) : set({ rooms: next });
      const known = list.some((r) => (r._id || r.id)?.toString() === idStr);
      const isOpen = selectedChat?.id?.toString() === idStr;

      if (!stillMember) {
        // I was removed (or this was never mine): drop it, and close it if open.
        if (!known && !isOpen) return;
        setList(list.filter((r) => (r._id || r.id)?.toString() !== idStr));
        if (isOpen) set({ selectedChat: null });
        return;
      }

      if (!known) {
        // I was just added: insert live and join its socket room.
        setList([updatedRoom, ...list]);
        socket.emit("joinRoom", updatedRoom._id);
      } else {
        setList(list.map((r) => ((r._id || r.id)?.toString() === idStr ? { ...r, ...updatedRoom } : r)));
      }
      if (isOpen) {
        set({
          selectedChat: {
            ...selectedChat,
            name: updatedRoom.name,
            description: updatedRoom.description,
            members: updatedRoom.members,
            admins: updatedRoom.admins,
            createdBy: updatedRoom.createdBy,
            avatar: updatedRoom.avatar,
          },
        });
      }
    });


    // Real-time new room creation (server notifies members only; ignore
    // anything we are not a member of so foreign groups never enter the list)
    socket.on("newRoom", (newRoom) => {
      const myId = useAuthStore.getState().authUser?._id?.toString();
      const isMember = (newRoom.members || []).some(
        (m) => (m._id || m)?.toString() === myId
      );
      if (!isMember) return;
      if (newRoom.isChannel) {
        const { channels } = get();
        if (!channels.some((r) => (r._id || r.id)?.toString() === newRoom._id?.toString())) {
          set({ channels: [newRoom, ...channels] });
        }
      } else {
        const { rooms } = get();
        if (!rooms.some((r) => r._id === newRoom._id)) {
          set({ rooms: [newRoom, ...rooms] });
        }
      }
      socket.emit("joinRoom", newRoom._id);
    });

    // Admins learn about incoming join requests live
    socket.on("joinRequestReceived", ({ roomId }) => {
      if (!roomId) return;
      set({ joinRequestPing: { roomId: roomId.toString(), at: Date.now() } });
    });

    // Real-time reactions
    socket.on("messageReaction", ({ messageId, reactions }) => {
      const { messages } = get();
      const updated = messages.map((m) =>
        m._id === messageId ? { ...m, reactions } : m
      );
      set({ messages: updated });
    });

    // Real-time polls
    socket.on("pollUpdated", ({ messageId, poll }) => {
      const { messages } = get();
      const updated = messages.map((m) =>
        m._id === messageId ? { ...m, poll } : m
      );
      set({ messages: updated });
    });

    // Real-time typing indicators
    socket.on("userTyping", ({ username, targetId }) => {
      const current = get().typingUsers[targetId] || [];
      if (!current.includes(username)) {
        set({
          typingUsers: {
            ...get().typingUsers,
            [targetId]: [...current, username],
          },
        });
      }
    });

    socket.on("userStoppedTyping", ({ targetId, username }) => {
      const current = get().typingUsers[targetId] || [];
      set({
        typingUsers: {
          ...get().typingUsers,
          [targetId]: current.filter((u) => u !== username),
        },
      });
    });

    // Real-time message delivered receipts
    socket.on("messageDelivered", ({ messageId, delivererId, chatId }) => {
      const { messages, selectedChat, lastMessages } = get();
      
      let updatedLastMessages = { ...lastMessages };
      const lastMsg = updatedLastMessages[chatId];
      if (lastMsg) {
        if (!messageId || lastMsg._id === messageId) {
          const deliveries = lastMsg.deliveries || [];
          if (!deliveries.some(d => d.userId === delivererId)) {
            updatedLastMessages[chatId] = {
              ...lastMsg,
              deliveries: [...deliveries, { userId: delivererId, at: new Date().toISOString() }]
            };
          }
        }
      }

      const updates = { lastMessages: updatedLastMessages };

      if (selectedChat && selectedChat.id === chatId) {
        const updated = messages.map((m) => {
          if (messageId && m._id !== messageId) return m;
          const deliveries = m.deliveries || [];
          if (!deliveries.some(d => d.userId === delivererId)) {
            return { ...m, deliveries: [...deliveries, { userId: delivererId, at: new Date().toISOString() }] };
          }
          return m;
        });
        updates.messages = updated;
      }
      
      set(updates);
    });

    // Real-time read receipts
    socket.on("messagesRead", ({ chatId, readerId, type: _type }) => {
      const { messages, selectedChat, lastMessages } = get();
      
      let updatedLastMessages = { ...lastMessages };
      const lastMsg = updatedLastMessages[chatId];
      if (lastMsg) {
        const readBy = lastMsg.readBy || [];
        const reads = lastMsg.reads || [];
        if (!readBy.includes(readerId)) {
          updatedLastMessages[chatId] = {
            ...lastMsg,
            readBy: [...readBy, readerId],
            reads: [...reads, { userId: readerId, at: new Date().toISOString() }]
          };
        }
      }

      const updates = { lastMessages: updatedLastMessages };

      if (selectedChat && selectedChat.id === chatId) {
        const updated = messages.map((m) => {
          const readBy = m.readBy || [];
          const reads = m.reads || [];
          let modified = false;
          let newReadBy = [...readBy];
          let newReads = [...reads];
          
          if (!newReadBy.includes(readerId)) {
            newReadBy.push(readerId);
            modified = true;
          }
          if (!newReads.some(r => r.userId === readerId)) {
            newReads.push({ userId: readerId, at: new Date().toISOString() });
            modified = true;
          }
          if (modified) {
            return { ...m, readBy: newReadBy, reads: newReads };
          }
          return m;
        });
        updates.messages = updated;
      }

      set(updates);
    });

    // Real-time message deletion
    socket.on("messageDeleted", ({ messageId }) => {
      const { messages, lastMessages } = get();
      const updated = messages.map((m) =>
        m._id === messageId
          ? { ...m, isDeleted: true, text: "This message was deleted", decryptedText: "This message was deleted", image: null, audio: null, file: null, reactions: [] }
          : m
      );
      const newLastMessages = { ...lastMessages };
      Object.keys(newLastMessages).forEach((key) => {
        if (newLastMessages[key]?._id === messageId) {
          newLastMessages[key] = {
            ...newLastMessages[key],
            isDeleted: true,
            text: "This message was deleted",
            decryptedText: "This message was deleted",
            image: null,
            audio: null,
            file: null,
          };
        }
      });
      set({ messages: updated, lastMessages: newLastMessages });
    });

    // View-once media fully consumed: wipe the payload everywhere
    socket.on("viewOnceConsumed", ({ messageId }) => {
      if (!messageId) return;
      const { messages, lastMessages } = get();
      const idStr = messageId.toString();
      const updated = messages.map((m) =>
        (m._id || m.id)?.toString() === idStr
          ? { ...m, image: null, audio: null, viewOnceOpened: true }
          : m
      );
      const newLastMessages = { ...lastMessages };
      Object.keys(newLastMessages).forEach((key) => {
        if (newLastMessages[key]?._id?.toString() === idStr) {
          newLastMessages[key] = { ...newLastMessages[key], image: null, audio: null, viewOnceOpened: true };
        }
      });
      set({ messages: updated, lastMessages: newLastMessages });
    });

    // Real-time message pinning
    socket.on("messagePinned", ({ messageId, isPinned }) => {
      const { messages } = get();
      const updated = messages.map((m) =>
        m._id === messageId ? { ...m, isPinned } : m
      );
      set({ messages: updated });
    });

    // Real-time group deletion (leave-last-out, creator delete, kick cleanup)
    socket.on("roomDeleted", ({ roomId }) => {
      if (!roomId) return;
      const { rooms, channels, selectedChat } = get();
      const idStr = roomId.toString();
      set({
        rooms: (rooms || []).filter((r) => (r._id || r.id)?.toString() !== idStr),
        channels: (channels || []).filter((r) => (r._id || r.id)?.toString() !== idStr),
        selectedChat: selectedChat?.id?.toString() === idStr ? null : selectedChat,
      });
    });

    // Real-time live-location position updates
    socket.on("locationUpdated", ({ messageId, location, liveUntil }) => {
      if (!messageId) return;
      const { messages } = get();
      set({
        messages: messages.map((m) =>
          (m._id || m.id)?.toString() === messageId.toString()
            ? { ...m, location: location || m.location, liveUntil: liveUntil || m.liveUntil }
            : m
        ),
      });
    });

    // Real-time group events
    const upsertEvent = (event) => {
      set((state) => {
        const exists = state.events.some((e) => e._id === event._id);
        const next = exists
          ? state.events.map((e) => (e._id === event._id ? event : e))
          : [...state.events, event];
        return {
          events: next.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)),
        };
      });
    };
    socket.on("eventCreated", ({ event }) => {
      if (!event) return;
      upsertEvent(event);
      soundManager.playReceiveSound();
    });
    socket.on("eventUpdated", ({ event }) => {
      if (!event) return;
      upsertEvent(event);
    });
    socket.on("eventRsvp", ({ event }) => {
      if (!event) return;
      upsertEvent(event);
    });
    socket.on("eventDeleted", ({ eventId }) => {
      set((state) => ({ events: state.events.filter((e) => e._id !== eventId) }));
    });

    // Real-time tasks
    socket.on("taskCreated", ({ task }) => {
      if (!task?._id) return;
      set((state) => {
        if (state.tasks.some((t) => t._id === task._id)) return state;
        return { tasks: [task, ...state.tasks] };
      });
      soundManager.playReceiveSound();
    });
    socket.on("taskUpdated", ({ task }) => {
      if (!task?._id) return;
      set((state) => ({
        tasks: state.tasks.map((t) => (t._id === task._id ? task : t)),
      }));
    });
    socket.on("taskDeleted", ({ task }) => {
      const deletedId = task?._id;
      if (!deletedId) return;
      set((state) => ({ tasks: state.tasks.filter((t) => t._id !== deletedId) }));
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    
    // Only remove our chat reconnect handler, not the auth presence handler
    if (socket._chatReconnectHandler) {
      socket.off("connect", socket._chatReconnectHandler);
      socket._chatReconnectHandler = null;
    }
    socket.off("chat:reconnect-resync");
    socket.off("newMessage");
    socket.off("threadUpdated");
    socket.off("messageReaction");
    socket.off("messageEdited");
    socket.off("newRoom");
    socket.off("joinRequestReceived");
    socket.off("userTyping");
    socket.off("userStoppedTyping");
    socket.off("messagesRead");
    socket.off("messageDeleted");
    socket.off("viewOnceConsumed");
    socket.off("messagePinned");
    socket.off("roomDeleted");
    socket.off("locationUpdated");
    socket.off("messageExpired");
    socket.off("roomUpdated");
    socket.off("pollUpdated");
    socket.off("newStatus");
    socket.off("deletedStatus");
    socket.off("messageDelivered");
    socket.off("reminderDue");
    socket.off("eventCreated");
    socket.off("eventUpdated");
    socket.off("eventDeleted");
    socket.off("eventRsvp");
    socket.off("taskCreated");
    socket.off("taskUpdated");
    socket.off("taskDeleted");
  },

  deleteMessage: async (messageId) => {
    try {
      await axiosInstance.delete(`/chat/message/${messageId}`);
      const { messages, lastMessages } = get();
      const updated = messages.map((m) =>
        m._id === messageId
          ? { ...m, isDeleted: true, text: "This message was deleted", decryptedText: "This message was deleted", image: null, audio: null, file: null, reactions: [] }
          : m
      );
      const newLastMessages = { ...lastMessages };
      Object.keys(newLastMessages).forEach((key) => {
        if (newLastMessages[key]?._id === messageId) {
          newLastMessages[key] = {
            ...newLastMessages[key],
            isDeleted: true,
            text: "This message was deleted",
            decryptedText: "This message was deleted",
            image: null,
            audio: null,
            file: null,
          };
        }
      });
      set({ messages: updated, lastMessages: newLastMessages });
      return { success: true };
    } catch (error) {
      console.error("Error deleting message:", error);
      return { success: false };
    }
  },

  // Delete for me: hides any message from my own views only
  hideMessage: async (messageId) => {
    try {
      await axiosInstance.post(`/chat/message/${messageId}/hide`);
      const { messages, threadReplies, lastMessages } = get();
      const idStr = messageId?.toString();
      const newLastMessages = { ...lastMessages };
      let changedLast = false;
      Object.keys(newLastMessages).forEach((key) => {
        if (newLastMessages[key]?._id?.toString() === idStr) {
          const rest = (messages || []).filter((m) => (m._id || m.id)?.toString() !== idStr);
          newLastMessages[key] = rest[rest.length - 1] || null;
          changedLast = true;
        }
      });
      set({
        messages: (messages || []).filter((m) => (m._id || m.id)?.toString() !== idStr),
        threadReplies: (threadReplies || []).filter((r) => (r._id || r.id)?.toString() !== idStr),
        ...(changedLast ? { lastMessages: newLastMessages } : {}),
      });
      return { success: true };
    } catch (error) {
      console.error("Error hiding message:", error);
      return { success: false };
    }
  },

  togglePinMessage: async (messageId) => {
    try {
      const res = await axiosInstance.post(`/chat/message/${messageId}/pin`);
      const { messages } = get();
      const updated = messages.map((m) =>
        m._id === messageId ? { ...m, isPinned: res.data.isPinned } : m
      );
      set({ messages: updated });
      return { success: true, isPinned: res.data.isPinned };
    } catch (error) {
      console.error("Error toggling pin message:", error);
      return { success: false };
    }
  },

  pendingJumpMessageId: null,

  // Jump to any message (e.g. from Starred drawer): switches chat first if
  // the message lives in a different conversation, then scrolls to it.
  jumpToMessage: (msg) => {
    const msgId = msg?._id || msg;
    if (!msgId) return;
    const myId = useAuthStore.getState().authUser?._id?.toString();
    const state = get();
    const roomId = (msg?.roomId?._id || msg?.roomId)?.toString();

    let target = null;
    if (roomId) {
      const room =
        (state.rooms || []).find((r) => (r._id || r.id)?.toString() === roomId) ||
        (state.channels || []).find((r) => (r._id || r.id)?.toString() === roomId);
      target = {
        id: roomId,
        _id: roomId,
        type: "room",
        name: room?.name || "Group",
        description: room?.description || "",
        members: room?.members || [],
        createdBy: room?.createdBy,
        admins: room?.admins,
        avatar: room?.avatar,
        profilePic: room?.profilePic,
        isChannel: !!room?.isChannel,
      };
    } else if (msg && typeof msg === "object") {
      const senderId = (msg.senderId?._id || msg.senderId)?.toString();
      const receiverId = (msg.receiverId?._id || msg.receiverId)?.toString();
      const otherId = senderId === myId ? receiverId : senderId;
      if (otherId) {
        const friends = useFriendStore.getState().friends || [];
        const users = state.users || [];
        const person = [...friends, ...users].find(
          (f) => (f._id || f.id)?.toString() === otherId
        );
        const fallbackName =
          senderId === myId ? "Saved Messages" : msg.senderId?.username || "Chat";
        target = {
          id: otherId,
          type: "user",
          name: person?.username || fallbackName,
          profilePic: person?.profilePic,
          avatar: person?.profilePic || person?.avatar,
        };
      }
    }

    set({ pendingJumpMessageId: msgId, isStarredOpen: false });
    if (target?.id && state.selectedChat?.id?.toString() !== target.id.toString()) {
      get().setSelectedChat(target);
    }

    // Poll until the message element is rendered (covers chat-switch load time)
    // Tracked + cancellable: a new jump clears the previous timer.
    try {
      if (get()._jumpTimer) clearInterval(get()._jumpTimer);
    } catch {}
    let tries = 0;
    const jumpId = msgId;
    const timer = setInterval(() => {
      // Stale timer (a newer jump started) — stop.
      try {
        if (get().pendingJumpMessageId !== jumpId) {
          clearInterval(timer);
          return;
        }
      } catch {}
      tries++;
      const el = typeof document !== "undefined" && document.getElementById(`msg-${msgId}`);
      if (el) {
        clearInterval(timer);
        try {
          if (get()._jumpTimer === timer) set({ _jumpTimer: null });
        } catch {}
        set({ pendingJumpMessageId: null });
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-accent-primary", "rounded-2xl", "shadow-glow");
        setTimeout(() => el.classList.remove("ring-2", "ring-accent-primary", "shadow-glow"), 2000);
      } else if (tries > 25) {
        clearInterval(timer);
        try {
          if (get()._jumpTimer === timer) set({ _jumpTimer: null });
        } catch {}
        set({ pendingJumpMessageId: null });
      }
    }, 300);
    set({ _jumpTimer: timer });
  },

  setSelectedChat: (chat) => {
    const current = get().selectedChat;
    const socket = useAuthStore.getState().socket;
    const unread = { ...get().unreadCounts };
    if (chat?.id) unread[chat.id] = 0;

    if (socket) {
      const prevRoom = current?.type === "room" ? current?.id?.toString() : null;
      const nextRoom = chat?.type === "room" ? chat?.id?.toString() : null;
      if (prevRoom && prevRoom !== nextRoom) {
        try {
          socket.emit("leaveRoom", prevRoom);
        } catch {}
      }
      if (nextRoom && prevRoom !== nextRoom) {
        socket.emit("joinRoom", chat.id);
      }
    }

    const sameChat =
      current?.id?.toString() === chat?.id?.toString() && (current?.type || null) === (chat?.type || null);
    if (!sameChat) {
      set({ 
        selectedChat: chat, 
        messages: [], 
        scheduledMessages: [],
        isMessagesLoading: chat ? true : false,
        replyingTo: null,
        editingMessage: null,
        isStarredOpen: false,
        isGroupInfoOpen: false,
        isThreadOpen: false,
        activeThreadMessage: null,
        threadReplies: [],
        unreadCounts: unread,
      });
    } else {
      set({ selectedChat: chat, unreadCounts: unread });
    }
  },

  getScheduledMessages: async (chatId, type) => {
    try {
      const res = await axiosInstance.get(`/chat/scheduled/${chatId}?type=${type}`);
      const authUser = useAuthStore.getState().authUser;
      const key = getConversationKey({ id: chatId, type }, authUser?._id);

      const decrypted = await Promise.all(
        res.data.map(async (m) => {
          if (m.isEncrypted || isEncryptedMessage(m.text)) {
            const dec = await decryptMessage(m.text, key);
            return { ...m, decryptedText: dec };
          }
          return m;
        })
      );

      set({ scheduledMessages: decrypted });
      return decrypted;
    } catch (error) {
      console.error("Error fetching scheduled messages:", error);
      return [];
    }
  },

  cancelScheduledMessage: async (messageId) => {
    try {
      await axiosInstance.delete(`/chat/scheduled/${messageId}`);
      set((state) => ({
        scheduledMessages: state.scheduledMessages.filter((m) => m._id !== messageId),
      }));
      return { success: true };
    } catch (error) {
      console.error("Error cancelling scheduled message:", error);
      return { success: false };
    }
  },

  updateGroupInfo: async (roomId, data) => {
    try {
      const res = await axiosInstance.put(`/chat/rooms/${roomId}`, data);
      const updatedRoom = res.data;
      const { rooms, selectedChat } = get();
      set({
        rooms: rooms.map((r) => (r._id === roomId ? updatedRoom : r)),
        selectedChat: selectedChat?.id === roomId ? { ...selectedChat, ...updatedRoom } : selectedChat,
      });
      return { success: true, room: updatedRoom };
    } catch (error) {
      console.error("Error updating group info:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  kickGroupMember: async (roomId, userId) => {
    try {
      const res = await axiosInstance.delete(`/chat/rooms/${roomId}/members/${userId}`);
      const updatedRoom = res.data.room;
      const { rooms, selectedChat } = get();
      set({
        rooms: rooms.map((r) => (r._id === roomId ? updatedRoom : r)),
        selectedChat: selectedChat?.id === roomId ? { ...selectedChat, ...updatedRoom } : selectedChat,
      });
      return { success: true };
    } catch (error) {
      console.error("Error kicking group member:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  addGroupMembers: async (roomId, memberIds) => {
    try {
      const res = await axiosInstance.post(`/chat/rooms/${roomId}/members`, { memberIds });
      const updatedRoom = res.data.room;
      const { rooms, selectedChat } = get();
      set({
        rooms: rooms.map((r) => (r._id === roomId ? updatedRoom : r)),
        selectedChat: selectedChat?.id === roomId ? { ...selectedChat, ...updatedRoom } : selectedChat,
      });
      return { success: true, room: updatedRoom };
    } catch (error) {
      console.error("Error adding group members:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  toggleGroupAdmin: async (roomId, userId) => {
    try {
      const res = await axiosInstance.post(`/chat/rooms/${roomId}/admins`, { userId });
      const updatedRoom = res.data.room;
      const { rooms, selectedChat } = get();
      set({
        rooms: rooms.map((r) => (r._id === roomId ? updatedRoom : r)),
        selectedChat: selectedChat?.id === roomId ? { ...selectedChat, ...updatedRoom } : selectedChat,
      });
      return { success: true, room: updatedRoom };
    } catch (error) {
      console.error("Error toggling group admin:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // ---- Group invite links, leave & delete ----
  createInviteCode: async (roomId) => {
    try {
      const res = await axiosInstance.post(`/chat/rooms/${roomId}/invite`);
      return { success: true, inviteCode: res.data.inviteCode };
    } catch (error) {
      console.error("Error creating invite link:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  revokeInviteCode: async (roomId) => {
    try {
      await axiosInstance.delete(`/chat/rooms/${roomId}/invite`);
      return { success: true };
    } catch (error) {
      console.error("Error revoking invite link:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  joinGroupByCode: async (code) => {
    try {
      const clean = (code || "").trim();
      if (!clean) return { success: false, error: "Invite code is required" };
      const res = await axiosInstance.post(`/chat/rooms/join/${encodeURIComponent(clean)}`);
      const room = res.data;
      const { rooms } = get();
      if (room?._id && !rooms.some((r) => (r._id || r.id)?.toString() === room._id.toString())) {
        set({ rooms: [room, ...rooms] });
      }
      return { success: true, room };
    } catch (error) {
      console.error("Error joining group:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  leaveGroup: async (roomId) => {
    try {
      const res = await axiosInstance.post(`/chat/rooms/${roomId}/leave`);
      const { rooms, selectedChat } = get();
      const idStr = roomId?.toString();
      if (res.data?.deleted || !res.data?.room) {
        set({
          rooms: (rooms || []).filter((r) => (r._id || r.id)?.toString() !== idStr),
          selectedChat: selectedChat?.id?.toString() === idStr ? null : selectedChat,
        });
      } else {
        const updatedRoom = res.data.room;
        set({
          rooms: rooms.map((r) => ((r._id || r.id)?.toString() === idStr ? updatedRoom : r)),
          selectedChat: selectedChat?.id?.toString() === idStr ? null : selectedChat,
        });
      }
      return { success: true, deleted: !!res.data?.deleted, transferredTo: res.data?.transferredTo };
    } catch (error) {
      console.error("Error leaving group:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  deleteGroup: async (roomId) => {
    try {
      await axiosInstance.delete(`/chat/rooms/${roomId}`);
      const { rooms, selectedChat } = get();
      const idStr = roomId?.toString();
      set({
        rooms: (rooms || []).filter((r) => (r._id || r.id)?.toString() !== idStr),
        selectedChat: selectedChat?.id?.toString() === idStr ? null : selectedChat,
      });
      return { success: true };
    } catch (error) {
      console.error("Error deleting group:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // ---- Broadcast channels ----
  channels: [],
  publicChannels: [],
  isChannelsLoading: false,

  getChannels: async () => {
    try {
      const res = await axiosInstance.get("/chat/channels");
      set({ channels: res.data || [] });
      return res.data;
    } catch (error) {
      console.error("Error fetching channels:", error);
      return [];
    }
  },

  getPublicChannels: async (q = "") => {
    set({ isChannelsLoading: true });
    try {
      const res = await axiosInstance.get(`/chat/channels/directory${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      set({ publicChannels: res.data || [] });
      return res.data;
    } catch (error) {
      console.error("Error fetching channel directory:", error);
      return [];
    } finally {
      set({ isChannelsLoading: false });
    }
  },

  createChannel: async ({ name, description }) => {
    try {
      const res = await axiosInstance.post("/chat/channels", { name, description });
      const room = res.data;
      const { channels } = get();
      if (room?._id && !channels.some((r) => (r._id || r.id)?.toString() === room._id.toString())) {
        set({ channels: [room, ...channels] });
      }
      return { success: true, room };
    } catch (error) {
      console.error("Error creating channel:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  followChannel: async (roomId) => {
    try {
      const res = await axiosInstance.post(`/chat/channels/${roomId}/follow`);
      const room = res.data;
      const { channels } = get();
      if (room?._id && !channels.some((r) => (r._id || r.id)?.toString() === room._id.toString())) {
        set({ channels: [room, ...channels] });
      }
      return { success: true, room };
    } catch (error) {
      console.error("Error following channel:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  unfollowChannel: async (roomId) => {
    try {
      await axiosInstance.post(`/chat/channels/${roomId}/unfollow`);
      const { channels, selectedChat } = get();
      const idStr = roomId?.toString();
      set({
        channels: (channels || []).filter((r) => (r._id || r.id)?.toString() !== idStr),
        selectedChat: selectedChat?.id?.toString() === idStr ? null : selectedChat,
      });
      return { success: true };
    } catch (error) {
      console.error("Error unfollowing channel:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // ---- Membership approval ----
  toggleJoinApproval: async (roomId) => {
    try {
      const res = await axiosInstance.put(`/chat/rooms/${roomId}/approval`);
      const updatedRoom = res.data?.room;
      if (updatedRoom) {
        const { rooms, selectedChat } = get();
        const idStr = roomId?.toString();
        set({
          rooms: (rooms || []).map((r) => ((r._id || r.id)?.toString() === idStr ? updatedRoom : r)),
          selectedChat: selectedChat?.id?.toString() === idStr ? { ...selectedChat, ...updatedRoom } : selectedChat,
        });
      }
      return { success: true, requireApproval: res.data?.requireApproval, room: updatedRoom };
    } catch (error) {
      console.error("Error toggling join approval:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  getJoinRequests: async (roomId) => {
    try {
      const res = await axiosInstance.get(`/chat/rooms/${roomId}/requests`);
      return res.data || [];
    } catch (error) {
      console.error("Error fetching join requests:", error);
      return [];
    }
  },

  resolveJoinRequest: async (roomId, userId, action) => {
    try {
      const res = await axiosInstance.post(`/chat/rooms/${roomId}/requests/${userId}`, { action });
      if (res.data?.approved && res.data?.room) {
        const updatedRoom = res.data.room;
        const { rooms, selectedChat } = get();
        const idStr = roomId?.toString();
        set({
          rooms: (rooms || []).map((r) => ((r._id || r.id)?.toString() === idStr ? updatedRoom : r)),
          selectedChat: selectedChat?.id?.toString() === idStr ? { ...selectedChat, ...updatedRoom } : selectedChat,
        });
      }
      return { success: true, ...res.data };
    } catch (error) {
      console.error("Error resolving join request:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // ---- Broadcast lists ----
  broadcasts: [],
  isBroadcastsLoading: false,

  getBroadcasts: async () => {
    set({ isBroadcastsLoading: true });
    try {
      const res = await axiosInstance.get("/chat/broadcasts");
      set({ broadcasts: res.data || [] });
      return res.data;
    } catch (error) {
      console.error("Error fetching broadcasts:", error);
      return [];
    } finally {
      set({ isBroadcastsLoading: false });
    }
  },

  createBroadcast: async ({ name, recipientIds }) => {
    try {
      const res = await axiosInstance.post("/chat/broadcasts", { name, recipientIds });
      set((state) => ({ broadcasts: [res.data, ...state.broadcasts] }));
      return { success: true, list: res.data };
    } catch (error) {
      console.error("Error creating broadcast:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  updateBroadcast: async (id, { name, recipientIds }) => {
    try {
      const res = await axiosInstance.put(`/chat/broadcasts/${id}`, { name, recipientIds });
      set((state) => ({
        broadcasts: state.broadcasts.map((b) => (b._id === id ? res.data : b)),
      }));
      return { success: true, list: res.data };
    } catch (error) {
      console.error("Error updating broadcast:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  deleteBroadcast: async (id) => {
    try {
      await axiosInstance.delete(`/chat/broadcasts/${id}`);
      set((state) => ({ broadcasts: state.broadcasts.filter((b) => b._id !== id) }));
      return { success: true };
    } catch (error) {
      console.error("Error deleting broadcast:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  sendBroadcast: async (id, messageData) => {
    try {
      const res = await axiosInstance.post(`/chat/broadcasts/${id}/send`, messageData);
      return { success: true, ...res.data };
    } catch (error) {
      console.error("Error sending broadcast:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // ---- Live location ----
  updateLiveLocation: async (messageId, lat, lng) => {
    try {
      await axiosInstance.put(`/chat/message/${messageId}/location`, { lat, lng });
      return { success: true };
    } catch (error) {
      if (error.response?.status === 410) return { success: false, expired: true };
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  stopLiveLocation: async (messageId) => {
    try {
      const res = await axiosInstance.post(`/chat/message/${messageId}/stop-live`);
      const { messages } = get();
      set({
        messages: messages.map((m) =>
          (m._id || m.id)?.toString() === messageId?.toString()
            ? { ...m, liveUntil: res.data?.liveUntil || new Date().toISOString() }
            : m
        ),
      });
      return { success: true };
    } catch (error) {
      console.error("Error stopping live location:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  forwardMessage: async ({ message, targetChat, silent }) => {
    try {
      const authUser = useAuthStore.getState().authUser;
      const plainText = message.decryptedText || message.text || "";
      let textToSend = plainText;
      let isEncrypted = false;

      if (plainText) {
        const key = getConversationKey(targetChat, authUser?._id);
        textToSend = await encryptMessage(plainText, key);
        isEncrypted = isEncryptedMessage(textToSend);
      }

      // Unopened view-once media must never leak through forwarding
      const viewOnceBlocked = message.viewOnce && !message.viewOnceOpened;
      const fwdImage = viewOnceBlocked ? null : message.image || null;
      const fwdAudio = viewOnceBlocked ? null : message.audio || null;
      if (!plainText && !fwdImage && !fwdAudio && !message.file && !message.contact && !message.poll) {
        return { success: false, error: "View-once media can't be forwarded" };
      }

      const payload = {
        text: textToSend,
        image: fwdImage,
        audio: fwdAudio,
        file: message.file || null,
        contact: message.contact || null,
        poll: message.poll?.options?.length > 0 ? message.poll : null,
        isForwarded: true,
        isEncrypted,
      };

      if (targetChat.type === "room") {
        payload.roomId = targetChat.id;
      }

      const endpoint = `/chat/send/${targetChat.type === "user" ? targetChat.id : ""}`;
      const res = await axiosInstance.post(endpoint, payload);

      const returnedMessage = {
        ...res.data,
        decryptedText: plainText,
      };

      const { selectedChat, messages } = get();
      if (selectedChat && selectedChat.id === targetChat.id) {
        set({ messages: [...messages, returnedMessage] });
      }
      if (!silent) soundManager.playSendSound();
      return { success: true, data: returnedMessage };
    } catch (error) {
      console.error("Error in forwardMessage:", error);
      return { success: false, error: error.message };
    }
  },

  // WhatsApp-style bulk forward: forwards every selected message in order
  forwardMessages: async ({ messages: messagesToForward, targetChat }) => {
    const list = Array.isArray(messagesToForward) ? messagesToForward : [];
    if (list.length === 0 || !targetChat) {
      return { success: false, error: "Nothing to forward" };
    }
    // Preserve chronological order regardless of selection order
    const ordered = [...list].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    const results = [];
    for (const message of ordered) {
      results.push(await get().forwardMessage({ message, targetChat, silent: true }));
    }
    const okCount = results.filter((r) => r.success).length;
    if (okCount > 0) soundManager.playSendSound();
    return {
      success: okCount === ordered.length,
      forwardedCount: okCount,
      totalCount: ordered.length,
    };
  },

  // ---- Group Announcements ----
  announcements: [],
  showAnnouncementsOnly: false,
  setShowAnnouncementsOnly: (val) => set({ showAnnouncementsOnly: val }),
  getAnnouncements: async (roomId) => {
    if (!roomId) return [];
    try {
      const res = await axiosInstance.get(`/chat/rooms/${roomId}/announcements`);
      const authUser = useAuthStore.getState().authUser;
      const key = getConversationKey(get().selectedChat, authUser?._id);
      const decrypted = await Promise.all(
        (res.data || []).map(async (m) => {
          if (m.isEncrypted || isEncryptedMessage(m.text)) {
            try {
              const dec = await decryptMessage(m.text, key);
              return { ...m, decryptedText: dec };
            } catch {}
          }
          return m;
        })
      );
      set({ announcements: decrypted });
      return decrypted;
    } catch (error) {
      console.error("Error fetching announcements:", error);
      return [];
    }
  },

  // ---- Group Events ----
  events: [],
  isEventsOpen: false,
  setIsEventsOpen: (val) => set({ isEventsOpen: val }),
  getEvents: async (roomId, includePast = false) => {
    if (!roomId) return [];
    try {
      const res = await axiosInstance.get(
        `/chat/rooms/${roomId}/events${includePast ? "?includePast=true" : ""}`
      );
      set({ events: res.data || [] });
      return res.data || [];
    } catch (error) {
      console.error("Error fetching events:", error);
      return [];
    }
  },
  createEvent: async (payload) => {
    try {
      const res = await axiosInstance.post("/chat/events", payload);
      set((state) => ({
        events: [...state.events, res.data].sort(
          (a, b) => new Date(a.startsAt) - new Date(b.startsAt)
        ),
      }));
      soundManager.playSendSound();
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error creating event:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },
  updateEvent: async (eventId, payload) => {
    try {
      const res = await axiosInstance.put(`/chat/events/${eventId}`, payload);
      set((state) => ({
        events: state.events.map((e) => (e._id === eventId ? res.data : e)),
      }));
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error updating event:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },
  cancelEvent: async (eventId) => {
    try {
      await axiosInstance.delete(`/chat/events/${eventId}`);
      set((state) => ({ events: state.events.filter((e) => e._id !== eventId) }));
      return { success: true };
    } catch (error) {
      console.error("Error cancelling event:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },
  rsvpEvent: async (eventId, status) => {
    try {
      const res = await axiosInstance.post(`/chat/events/${eventId}/rsvp`, { status });
      set((state) => ({
        events: state.events.map((e) => (e._id === eventId ? res.data : e)),
      }));
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error RSVPing to event:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },

  // ---- Tasks ----
  tasks: [],
  isTasksOpen: false,
  tasksScope: "chat", // 'chat' | 'mine'
  setIsTasksOpen: (val) => set({ isTasksOpen: val }),
  setTasksScope: (val) => set({ tasksScope: val }),
  getTasks: async (params = {}) => {
    try {
      const search = new URLSearchParams();
      if (params.roomId) search.set("roomId", params.roomId);
      if (params.peerId) search.set("peerId", params.peerId);
      if (params.scope) search.set("scope", params.scope);
      if (params.showDone) search.set("showDone", "true");
      const res = await axiosInstance.get(`/chat/tasks?${search.toString()}`);
      set({ tasks: res.data || [] });
      return res.data || [];
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return [];
    }
  },
  createTask: async (payload) => {
    try {
      const res = await axiosInstance.post("/chat/tasks", payload);
      set((state) => ({ tasks: [res.data, ...state.tasks] }));
      soundManager.playSendSound();
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error creating task:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },
  toggleTask: async (taskId) => {
    try {
      const res = await axiosInstance.post(`/chat/tasks/${taskId}/toggle`);
      set((state) => ({
        tasks: state.tasks.map((t) => (t._id === taskId ? res.data : t)),
      }));
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error toggling task:", error);
      return { success: false };
    }
  },
  deleteTask: async (taskId) => {
    try {
      await axiosInstance.delete(`/chat/tasks/${taskId}`);
      set((state) => ({ tasks: state.tasks.filter((t) => t._id !== taskId) }));
      return { success: true };
    } catch (error) {
      console.error("Error deleting task:", error);
      return { success: false };
    }
  },

  // ---- Chat Labels ----
  labels: [],
  chatLabels: {},
  getLabels: async () => {
    try {
      const res = await axiosInstance.get("/chat/labels");
      set({ labels: res.data?.labels || [], chatLabels: res.data?.chatLabels || {} });
      return res.data;
    } catch (error) {
      console.error("Error fetching labels:", error);
      return { labels: [], chatLabels: {} };
    }
  },
  createLabel: async ({ name, color }) => {
    try {
      const res = await axiosInstance.post("/chat/labels", { name, color });
      set((state) => ({ labels: [...state.labels, res.data] }));
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error creating label:", error);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  },
  deleteLabel: async (labelId) => {
    try {
      await axiosInstance.delete(`/chat/labels/${labelId}`);
      set((state) => {
        const chatLabels = { ...state.chatLabels };
        Object.keys(chatLabels).forEach((chatId) => {
          chatLabels[chatId] = (chatLabels[chatId] || []).filter((id) => id !== labelId);
          if (chatLabels[chatId].length === 0) delete chatLabels[chatId];
        });
        return { labels: state.labels.filter((l) => l._id !== labelId), chatLabels };
      });
      return { success: true };
    } catch (error) {
      console.error("Error deleting label:", error);
      return { success: false };
    }
  },
  setChatLabels: async (chatId, labelIds) => {
    try {
      const res = await axiosInstance.put(`/chat/labels/chat/${chatId}`, { labelIds });
      set((state) => ({
        chatLabels: { ...state.chatLabels, [chatId]: res.data?.labelIds || [] },
      }));
      return { success: true };
    } catch (error) {
      console.error("Error setting chat labels:", error);
      return { success: false };
    }
  },

  // ---- Global Search ----
  globalSearchResults: [],
  isGlobalSearchLoading: false,
  searchMessages: async (filters = {}) => {
    set({ isGlobalSearchLoading: true });
    try {
      const search = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
      });
      const res = await axiosInstance.get(`/chat/search?${search.toString()}`);
      const authUser = useAuthStore.getState().authUser;
      const decrypted = await Promise.all(
        (res.data || []).map((m) => decryptMessageDoc(m, authUser?._id))
      );
      set({ globalSearchResults: decrypted });
      return decrypted;
    } catch (error) {
      console.error("Error searching messages:", error);
      return [];
    } finally {
      set({ isGlobalSearchLoading: false });
    }
  },
  clearGlobalSearch: () => set({ globalSearchResults: [] }),
}));
