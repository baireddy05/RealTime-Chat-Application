import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { soundManager } from "../lib/sound";
import { notificationManager } from "../lib/notification";
import {
  encryptMessage,
  decryptMessage,
  isEncryptedMessage,
  getConversationKey,
} from "../lib/crypto";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  rooms: [],
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
  disappearingTimer: null, // null, 5, 60, 3600, 86400 (seconds)
  scheduledMessages: [],
  isScheduledOpen: false,
  isWallpaperOpen: false,
  chatWallpapers: (() => {
    try {
      return JSON.parse(localStorage.getItem("pulse-chat-wallpapers") || "{}");
    } catch {
      return {};
    }
  })(),
  globalWallpaper: localStorage.getItem("pulse-global-wallpaper") || "default",

  setDisappearingTimer: (seconds) => set({ disappearingTimer: seconds }),
  setIsScheduledOpen: (val) => set({ isScheduledOpen: val }),
  setIsWallpaperOpen: (val) => set({ isWallpaperOpen: val }),

  setChatWallpaper: (chatId, wallpaperId) => {
    const { chatWallpapers } = get();
    const updated = { ...chatWallpapers, [chatId]: wallpaperId };
    try {
      localStorage.setItem("pulse-chat-wallpapers", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    set({ chatWallpapers: updated });
  },

  setGlobalWallpaper: (wallpaperId) => {
    try {
      localStorage.setItem("pulse-global-wallpaper", wallpaperId);
    } catch (e) {
      console.error(e);
    }
    set({ globalWallpaper: wallpaperId });
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

  // Feature 5: Client-Side E2EE
  isE2eeEnabled: false,
  toggleE2ee: () => set((state) => ({ isE2eeEnabled: !state.isE2eeEnabled })),
  setIsE2eeEnabled: (val) => set({ isE2eeEnabled: val }),

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

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/chat/users");
      const unread = { ...get().unreadCounts };
      const last = { ...get().lastMessages };
      res.data.forEach((u) => {
        if (u.unreadCount !== undefined) unread[u._id] = u.unreadCount;
        if (u.lastMessage) last[u._id] = u.lastMessage;
      });
      set({ users: res.data, unreadCounts: unread, lastMessages: last });
    } catch (error) {
      console.error(error);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getRooms: async () => {
    set({ isRoomsLoading: true });
    try {
      const res = await axiosInstance.get("/chat/rooms");
      const unread = { ...get().unreadCounts };
      const last = { ...get().lastMessages };
      res.data.forEach((r) => {
        if (r.unreadCount !== undefined) unread[r._id] = r.unreadCount;
        if (r.lastMessage) last[r._id] = r.lastMessage;
      });
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
      const key = getConversationKey(get().selectedChat, authUser?._id);

      const decryptedMessages = await Promise.all(
        res.data.map(async (m) => {
          if (m.isEncrypted || isEncryptedMessage(m.text)) {
            const dec = await decryptMessage(m.text, key);
            return { ...m, decryptedText: dec };
          }
          return m;
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
    const { activeThreadMessage, selectedChat, isE2eeEnabled } = get();
    if (!activeThreadMessage || !selectedChat) return { success: false };

    try {
      const authUser = useAuthStore.getState().authUser;
      let textToSend = replyData.text || "";
      const shouldEncrypt = replyData.isEncrypted ?? isE2eeEnabled;
      const originalText = textToSend;

      if (shouldEncrypt && textToSend) {
        const key = getConversationKey(selectedChat, authUser?._id);
        textToSend = await encryptMessage(textToSend, key);
      }

      const payload = {
        ...replyData,
        text: textToSend,
        isEncrypted: Boolean(shouldEncrypt),
        parentMessageId: activeThreadMessage._id,
      };

      if (selectedChat.type === "room") {
        payload.roomId = selectedChat.id;
      }

      const endpoint = `/chat/send/${selectedChat.type === "user" ? selectedChat.id : ""}`;
      const res = await axiosInstance.post(endpoint, payload);
      const returnedMessage = {
        ...res.data,
        decryptedText: shouldEncrypt ? originalText : res.data.text,
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
    try {
      await axiosInstance.post(`/chat/${chatId}/read?type=${type}`);
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  },

  reactToMessage: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.post(`/chat/${messageId}/react`, { emoji });
      // Optimistic update
      const { messages } = get();
      const updatedMessages = messages.map((m) =>
        m._id === messageId ? { ...m, reactions: res.data.reactions } : m
      );
      set({ messages: updatedMessages });
    } catch (error) {
      console.error("Error reacting to message:", error);
    }
  },

  sendMessage: async (messageData) => {
    const { selectedChat, messages, replyingTo, disappearingTimer, isE2eeEnabled } = get();
    if (!selectedChat) return;

    set({ isSending: true });
    try {
      const authUser = useAuthStore.getState().authUser;
      let textToSend = messageData.text || "";
      const shouldEncrypt = messageData.isEncrypted ?? isE2eeEnabled;
      const originalText = textToSend;

      if (shouldEncrypt && textToSend) {
        const key = getConversationKey(selectedChat, authUser?._id);
        textToSend = await encryptMessage(textToSend, key);
      }

      const payload = {
        ...messageData,
        text: textToSend,
        isEncrypted: Boolean(shouldEncrypt),
        expiresIn: messageData.expiresIn !== undefined ? messageData.expiresIn : (disappearingTimer || undefined),
        replyTo: messageData.replyTo !== undefined ? messageData.replyTo : (replyingTo ? {
          messageId: replyingTo._id,
          senderName: replyingTo.senderId?.username || replyingTo.senderName || "User",
          text: replyingTo.text || (replyingTo.image ? "📷 Photo" : replyingTo.file ? `📎 ${replyingTo.file.name}` : "Attachment"),
          image: replyingTo.image || null,
          file: replyingTo.file || null,
        } : null),
      };

      if (selectedChat.type === "room") {
        payload.roomId = selectedChat.id;
      }
        
      const endpoint = `/chat/send/${selectedChat.type === "user" ? selectedChat.id : ""}`;
      const res = await axiosInstance.post(endpoint, payload);

      const msgDataWithDecrypted = {
        ...res.data,
        decryptedText: shouldEncrypt ? originalText : res.data.text,
      };

      if (res.data.isScheduled) {
        set((state) => ({
          scheduledMessages: [...state.scheduledMessages, msgDataWithDecrypted],
          replyingTo: null,
        }));
      } else {
        set((state) => ({
          messages: [...state.messages, msgDataWithDecrypted],
          lastMessages: {
            ...state.lastMessages,
            [selectedChat.id]: msgDataWithDecrypted,
          },
          replyingTo: null,
        }));
        soundManager.playSendSound();
      }
      return { success: true, data: msgDataWithDecrypted };
    } catch (error) {
      console.error(error);
      return { success: false, error: error.message };
    } finally {
      set({ isSending: false });
    }
  },

  editMessage: async (messageId, text) => {
    try {
      const res = await axiosInstance.put(`/chat/message/${messageId}`, { text });
      const { messages, editingMessage } = get();
      const updated = messages.map((m) =>
        m._id === messageId ? { ...m, text: res.data.text, isEdited: true, updatedAt: res.data.updatedAt } : m
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

  getStarredMessages: async (chatId, type) => {
    set({ isStarredLoading: true });
    try {
      const res = await axiosInstance.get(`/chat/starred/${chatId}?type=${type}`);
      set({ starredMessages: res.data });
    } catch (error) {
      console.error("Error fetching starred messages:", error);
    } finally {
      set({ isStarredLoading: false });
    }
  },

  subscribeToMessages: () => {
    const { selectedChat } = get();
    if (!selectedChat) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // Join room if it's a room chat
    if (selectedChat.type === "room") {
      socket.emit("joinRoom", selectedChat.id);
    }

    socket.on("newMessage", async (newMessage) => {
      const myId = useAuthStore.getState().authUser?._id;
      const chatId = newMessage.roomId || (newMessage.senderId?._id === myId ? newMessage.receiverId : (newMessage.senderId?._id || newMessage.senderId));

      let processedMessage = newMessage;
      if (processedMessage.isEncrypted || isEncryptedMessage(processedMessage.text)) {
        const key = getConversationKey(selectedChat, myId);
        const dec = await decryptMessage(processedMessage.text, key);
        processedMessage = { ...processedMessage, decryptedText: dec };
      }

      // Always update last message in store
      set((state) => ({
        lastMessages: {
          ...state.lastMessages,
          [chatId]: processedMessage,
        },
      }));

      const isRoomMsg = selectedChat.type === "room" && processedMessage.roomId === selectedChat.id;
      const isUserMsg = selectedChat.type === "user" && 
        (processedMessage.senderId?._id === selectedChat.id || processedMessage.senderId === selectedChat.id || processedMessage.receiverId === selectedChat.id);

      if (isRoomMsg || isUserMsg) {
        set({ messages: [...get().messages, processedMessage] });
        get().markMessagesAsRead(selectedChat.id, selectedChat.type);

        const senderId = processedMessage.senderId?._id || processedMessage.senderId;
        if (senderId !== myId) {
          soundManager.playReceiveSound();
          const senderName = processedMessage.senderId?.username || "Pulse User";
          const title = selectedChat.type === "room"
            ? `${selectedChat.name} • ${senderName}`
            : senderName;
          const body = processedMessage.decryptedText || processedMessage.text || (processedMessage.image ? "📷 Photo" : processedMessage.file ? `📎 ${processedMessage.file.name}` : processedMessage.audio ? "🎤 Voice Note" : "New message");
          notificationManager.sendNotification({
            title,
            body,
            icon: processedMessage.senderId?.profilePic || "/favicon.ico",
          });
        }
      } else {
        // Increment unread count for the non-active chat
        const senderId = processedMessage.senderId?._id || processedMessage.senderId;
        if (senderId !== myId) {
          set((state) => ({
            unreadCounts: {
              ...state.unreadCounts,
              [chatId]: (state.unreadCounts[chatId] || 0) + 1,
            },
          }));
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

    // Real-time room updates (name, avatar, description, members, admins)
    socket.on("roomUpdated", (updatedRoom) => {
      const { rooms, selectedChat } = get();
      const updatedRooms = rooms.map((r) => (r._id === updatedRoom._id ? { ...r, ...updatedRoom } : r));
      set({ rooms: updatedRooms });
      if (selectedChat?.id === updatedRoom._id) {
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

    // Real-time message edit
    socket.on("messageEdited", ({ messageId, text, isEdited, updatedAt }) => {
      const { messages } = get();
      const updated = messages.map((m) =>
        m._id === messageId ? { ...m, text, isEdited, updatedAt } : m
      );
      set({ messages: updated });
    });

    // Real-time new room creation
    socket.on("newRoom", (newRoom) => {
      const { rooms } = get();
      if (!rooms.some((r) => r._id === newRoom._id)) {
        set({ rooms: [newRoom, ...rooms] });
      }
    });

    // Real-time reactions
    socket.on("messageReaction", ({ messageId, reactions }) => {
      const { messages } = get();
      const updated = messages.map((m) =>
        m._id === messageId ? { ...m, reactions } : m
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

    // Real-time read receipts
    socket.on("messagesRead", ({ chatId, readerId, type: _type }) => {
      const { messages, selectedChat } = get();
      if (!selectedChat || selectedChat.id !== chatId) return;
      const updated = messages.map((m) => {
        const readBy = m.readBy || [];
        if (!readBy.includes(readerId)) {
          return { ...m, readBy: [...readBy, readerId] };
        }
        return m;
      });
      set({ messages: updated });
    });

    // Real-time message deletion
    socket.on("messageDeleted", ({ messageId }) => {
      const { messages } = get();
      const updated = messages.map((m) =>
        m._id === messageId
          ? { ...m, isDeleted: true, text: "This message was deleted", image: null, audio: null, file: null, reactions: [] }
          : m
      );
      set({ messages: updated });
    });

    // Real-time message pinning
    socket.on("messagePinned", ({ messageId, isPinned }) => {
      const { messages } = get();
      const updated = messages.map((m) =>
        m._id === messageId ? { ...m, isPinned } : m
      );
      set({ messages: updated });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    const { selectedChat } = get();
    if (!socket) return;
    
    if (selectedChat && selectedChat.type === "room") {
      socket.emit("leaveRoom", selectedChat.id);
    }
    
    socket.off("newMessage");
    socket.off("threadUpdated");
    socket.off("messageReaction");
    socket.off("messageEdited");
    socket.off("newRoom");
    socket.off("userTyping");
    socket.off("userStoppedTyping");
    socket.off("messagesRead");
    socket.off("messageDeleted");
    socket.off("messagePinned");
    socket.off("messageExpired");
    socket.off("roomUpdated");
  },

  deleteMessage: async (messageId) => {
    try {
      await axiosInstance.delete(`/chat/message/${messageId}`);
      const { messages } = get();
      const updated = messages.map((m) =>
        m._id === messageId
          ? { ...m, isDeleted: true, text: "This message was deleted", image: null, audio: null, file: null, reactions: [] }
          : m
      );
      set({ messages: updated });
      return { success: true };
    } catch (error) {
      console.error("Error deleting message:", error);
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

  setSelectedChat: (chat) => {
    const current = get().selectedChat;
    const unread = { ...get().unreadCounts };
    if (chat?.id) unread[chat.id] = 0;

    if (current?.id !== chat?.id) {
      set({ 
        selectedChat: chat, 
        messages: [], 
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
      set({ scheduledMessages: res.data });
      return res.data;
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

  forwardMessage: async ({ message, targetChat }) => {
    try {
      const payload = {
        text: message.text || "",
        image: message.image || null,
        audio: message.audio || null,
        file: message.file || null,
        isForwarded: true,
      };

      if (targetChat.type === "room") {
        payload.roomId = targetChat.id;
      }

      const endpoint = `/chat/send/${targetChat.type === "user" ? targetChat.id : ""}`;
      const res = await axiosInstance.post(endpoint, payload);

      const { selectedChat, messages } = get();
      if (selectedChat && selectedChat.id === targetChat.id) {
        set({ messages: [...messages, res.data] });
      }
      soundManager.playSendSound();
      return { success: true, data: res.data };
    } catch (error) {
      console.error("Error in forwardMessage:", error);
      return { success: false, error: error.message };
    }
  },
}));
