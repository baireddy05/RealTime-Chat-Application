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
  networkStatuses: [],
  myStatuses: [],
  isScheduledOpen: false,
  isChatThemeOpen: false,
  isSettingsOpen: false,
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
      
      const myStatuses = allStatuses.filter((s) => s.userId._id === authUser._id || s.userId === authUser._id);
      
      // Group network statuses by user
      const networkMap = {};
      allStatuses.forEach((s) => {
        const uId = s.userId._id || s.userId;
        if (uId === authUser._id) return;
        
        if (!networkMap[uId]) {
          networkMap[uId] = {
            id: uId,
            user: s.userId.username,
            avatar: s.userId.profilePic,
            stories: [],
          };
        }
        networkMap[uId].stories.push({
          id: s._id,
          time: new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: s.text,
          bg: s.bg,
        });
      });
      
      set({ 
        myStatuses: myStatuses.map(s => ({
          id: s._id,
          time: new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: s.text,
          bg: s.bg,
        })),
        networkStatuses: Object.values(networkMap) 
      });
    } catch (error) {
      console.error("Error fetching statuses:", error);
    }
  },

  uploadStatus: async (text, bg) => {
    try {
      const res = await axiosInstance.post("/statuses", { text, bg });
      const authUser = useAuthStore.getState().authUser;
      
      const newStory = {
        id: res.data._id,
        time: new Date(res.data.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: res.data.text,
        bg: res.data.bg,
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
      const key = getConversationKey(get().selectedChat, authUser?._id);

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
        isEncrypted = true;
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
    const { selectedChat, replyingTo, disappearingTimer, isSending } = get();
    if (!selectedChat) return;
    if (isSending) return; // Prevent concurrent sends at store level

    set({ isSending: true });
    const authUser = useAuthStore.getState().authUser;
    let textToSend = messageData.text || "";
    const originalText = textToSend;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      let isEncrypted = false;

      // Encrypt all outgoing message text by default
      if (textToSend) {
        const key = getConversationKey(selectedChat, authUser?._id);
        textToSend = await encryptMessage(textToSend, key);
        isEncrypted = true;
      }

      const payload = {
        ...messageData,
        text: textToSend,
        isEncrypted,
        expiresIn: messageData.expiresIn !== undefined ? messageData.expiresIn : (disappearingTimer || undefined),
        replyTo: messageData.replyTo !== undefined ? messageData.replyTo : (replyingTo ? {
          messageId: replyingTo._id,
          senderName: replyingTo.senderId?.username || replyingTo.senderName || "User",
          text: replyingTo.decryptedText || replyingTo.text || (replyingTo.image ? "📷 Photo" : replyingTo.file ? `📎 ${replyingTo.file.name}` : replyingTo.contact ? `👤 Contact: ${replyingTo.contact.fullName || replyingTo.contact.username || "Contact"}` : "Attachment"),
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
            _id: authUser._id,
            username: authUser.username,
            profilePic: authUser.profilePic,
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
      // Remove optimistic placeholder on failure and restore previous last message
      set((state) => {
        const remaining = state.messages.filter((m) => m._id !== tempId);
        const prevLast = remaining[remaining.length - 1] || null;
        return {
          messages: remaining,
          lastMessages: {
            ...state.lastMessages,
            [selectedChat.id]: prevLast,
          },
        };
      });
      return { success: false, error: error.message };
    } finally {
      set({ isSending: false });
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
      const currentChat = get().selectedChat;
      const key = currentChat ? getConversationKey(currentChat, authUser?._id) : null;

      const decryptedMessages = await Promise.all(
        res.data.map(async (m) => {
          if (m.isEncrypted || isEncryptedMessage(m.text)) {
            try {
              if (key) {
                const dec = await decryptMessage(m.text, key);
                return { ...m, decryptedText: dec };
              }
            } catch {
              // Fallback if key doesn't match
            }
          }
          return m;
        })
      );

      set({ starredMessages: decryptedMessages });
    } catch (error) {
      console.error("Error fetching starred messages:", error);
    } finally {
      set({ isStarredLoading: false });
    }
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // Remove any existing listeners first to prevent duplicates
    // (React StrictMode double-mounts effects in dev mode)
    socket.off("newMessage");
    socket.off("threadUpdated");
    socket.off("messageExpired");
    socket.off("messageEdited");
    socket.off("roomUpdated");
    socket.off("newRoom");
    socket.off("messageReaction");
    socket.off("userTyping");
    socket.off("userStoppedTyping");
    socket.off("messagesRead");
    socket.off("messageDeleted");
    socket.off("messagePinned");

    const { selectedChat } = get();
    // Join room if it's a room chat
    if (selectedChat?.type === "room") {
      socket.emit("joinRoom", selectedChat.id);
    }

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
      set((state) => ({
        lastMessages: {
          ...state.lastMessages,
          [chatId]: processedMessage,
        },
      }));

      const isRoomMsg = selectedChat?.type === "room" && processedMessage.roomId?.toString() === selectedChat.id?.toString();
      const isUserMsg = selectedChat?.type === "user" && 
        (senderIdStr === selectedChat.id?.toString() || receiverIdStr === selectedChat.id?.toString());

      if (isRoomMsg || isUserMsg) {
        set((state) => {
          const exists = state.messages.some((m) => m._id === processedMessage._id);
          return {
            messages: exists ? state.messages : [...state.messages, processedMessage],
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
          soundManager.playReceiveSound();
          const senderName = processedMessage.senderId?.username || "Pulse User";
          const title = newMessage.roomId ? "New Group Message" : senderName;
          const body = processedMessage.decryptedText || processedMessage.text || (processedMessage.image ? "📷 Photo" : processedMessage.file ? `📎 ${processedMessage.file.name}` : processedMessage.audio ? "🎤 Voice Note" : "New message");
          notificationManager.sendNotification({
            title,
            body,
            icon: processedMessage.senderId?.profilePic || "/favicon.ico",
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
      const uId = status.userId._id || status.userId;
      if (uId === authUser._id) return;

      set((state) => {
        let networkMap = [...state.networkStatuses];
        const personIndex = networkMap.findIndex((p) => p.id === uId);
        
        const newStory = {
          id: status._id,
          time: new Date(status.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: status.text,
          bg: status.bg,
        };

        if (personIndex >= 0) {
          networkMap[personIndex].stories.push(newStory);
        } else {
          networkMap.push({
            id: uId,
            user: status.userId.username || "User",
            avatar: status.userId.profilePic || "",
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
    const socket = useAuthStore.getState().socket;
    const unread = { ...get().unreadCounts };
    if (chat?.id) unread[chat.id] = 0;

    if (socket) {
      if (current?.type === "room" && current.id !== chat?.id) {
        socket.emit("leaveRoom", current.id);
      }
      if (chat?.type === "room" && current?.id !== chat?.id) {
        socket.emit("joinRoom", chat.id);
      }
    }

    if (current?.id !== chat?.id) {
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
      const key = getConversationKey(get().selectedChat, authUser?._id);

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
      const authUser = useAuthStore.getState().authUser;
      const plainText = message.decryptedText || message.text || "";
      let textToSend = plainText;
      let isEncrypted = false;

      if (plainText) {
        const key = getConversationKey(targetChat, authUser?._id);
        textToSend = await encryptMessage(plainText, key);
        isEncrypted = true;
      }

      const payload = {
        text: textToSend,
        image: message.image || null,
        audio: message.audio || null,
        file: message.file || null,
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
      soundManager.playSendSound();
      return { success: true, data: returnedMessage };
    } catch (error) {
      console.error("Error in forwardMessage:", error);
      return { success: false, error: error.message };
    }
  },
}));
