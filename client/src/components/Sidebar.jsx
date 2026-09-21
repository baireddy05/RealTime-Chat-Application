import { memo, useEffect, useState, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useFriendStore } from "../store/useFriendStore";
import CreateGroupModal from "./CreateGroupModal";
import LabelsManagerModal from "./LabelsManagerModal";
import MessageTicks from "./MessageTicks";
import { isEncryptedMessage } from "../lib/crypto";
import { useBackHandler } from "../lib/backNavigation";

const ChatLabelDots = memo(({ chatId }) => {
  const labels = useChatStore((s) => s.labels);
  const chatLabels = useChatStore((s) => s.chatLabels);
  const ids = chatLabels[chatId] || [];
  if (ids.length === 0) return null;
  return (
    <span className="flex items-center gap-0.5 shrink-0">
      {ids.slice(0, 3).map((id) => {
        const label = (labels || []).find((l) => l._id === id);
        if (!label) return null;
        return (
          <span key={id} title={label.name} className="w-2 h-2 rounded-full" style={{ background: label.color }} />
        );
      })}
    </span>
  );
});

const formatTimeRelative = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  if (diffHours < 48) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const getMessageSnippet = (msg) => {
  if (!msg) return "";
  if (msg.isDeleted || msg.text === "This message was deleted" || msg.decryptedText === "This message was deleted") {
    return "🚫 This message was deleted";
  }
  if (msg.audio) return "🎤 Voice note";
  const isSticker = msg.isSticker || Boolean(msg.image && (msg.image.includes("/stickers/") || msg.image.includes("giphy-preview.gif") || msg.image.includes("sticker")));
    if (isSticker && (!msg.text || !msg.text.trim())) return "Sticker";
    if (msg.image) return "📷 Photo";
  if (msg.file) return `📎 ${msg.file.name || "Attachment"}`;
  if (msg.contact) return `👤 Contact: ${msg.contact.fullName || msg.contact.username || msg.contact.name || "Shared Contact"}`;

  const text = msg.decryptedText || msg.text || "";
  if (isEncryptedMessage(text)) {
    return "Message";
  }
  return text;
};

// Snippet around the match for unified message search results
const getSearchSnippet = (msg, query) => {
  const text = msg.decryptedText || (!isEncryptedMessage(msg.text) ? msg.text : "") || "";
  if (text) {
    const q = (query || "").trim().toLowerCase();
    const idx = q ? text.toLowerCase().indexOf(q) : 0;
    const start = Math.max(0, idx - 30);
    return (start > 0 ? "…" : "") + text.slice(start, start + 110) + (text.length > start + 110 ? "…" : "");
  }
  if (msg.image) return "📷 Photo";
  if (msg.audio) return "🎤 Voice note";
  if (msg.file) return `📎 ${msg.file.name || "File"}`;
  return "Message";
};

const getResultChatName = (msg, rooms) => {
  if (msg.roomId) {
    const rid = (msg.roomId?._id || msg.roomId)?.toString();
    const room = (rooms || []).find((r) => (r._id || r.id)?.toString() === rid);
    return room?.name?.replace(/^#/, "") || msg.roomId?.name?.replace(/^#/, "") || "Group";
  }
  return msg.senderId?.username || "Direct message";
};

const Sidebar = ({
  onChatSelect,
  onOpenProfile,
  onOpenSetStatus,
  onOpenAddFriend,
  onOpenCreateGroup,
  onOpenJoinGroup,
  onOpenBroadcast,
  onOpenCalls,
  onOpenStatus,
  onOpenStarred,
  statusEmoji = "💻",
  statusCategory = "Coding",
  statusDetail = "Available",
  handleInstallPWA,
  logout,
}) => {
  // Selective subscriptions: this list never reads `messages`, so it must not
  // re-render on every incoming message. Whole-store subscription did that.
  const rooms = useChatStore((s) => s.rooms);
  const users = useChatStore((s) => s.users);
  const getRooms = useChatStore((s) => s.getRooms);
  const selectedChat = useChatStore((s) => s.selectedChat);
  const setSelectedChat = useChatStore((s) => s.setSelectedChat);
  const unreadCounts = useChatStore((s) => s.unreadCounts);
  const lastMessages = useChatStore((s) => s.lastMessages);
  const setIsSettingsOpen = useChatStore((s) => s.setIsSettingsOpen);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const drafts = useChatStore((s) => s.drafts);
  const archivedChats = useChatStore((s) => s.archivedChats);
  const labels = useChatStore((s) => s.labels);
  const chatLabels = useChatStore((s) => s.chatLabels);
  const getLabels = useChatStore((s) => s.getLabels);
  const setChatLabels = useChatStore((s) => s.setChatLabels);
  const toggleArchiveChat = useChatStore((s) => s.toggleArchiveChat);
  const markMessagesAsRead = useChatStore((s) => s.markMessagesAsRead);
  const setIsGroupInfoOpen = useChatStore((s) => s.setIsGroupInfoOpen);
  const globalSearchResults = useChatStore((s) => s.globalSearchResults);
  const isGlobalSearchLoading = useChatStore((s) => s.isGlobalSearchLoading);
  const searchMessages = useChatStore((s) => s.searchMessages);
  const clearGlobalSearch = useChatStore((s) => s.clearGlobalSearch);
  const jumpToMessage = useChatStore((s) => s.jumpToMessage);

  const authUser = useAuthStore((s) => s.authUser);
  const onlineUsers = useAuthStore((s) => s.onlineUsers);
  const socket = useAuthStore((s) => s.socket);
  const friends = useFriendStore((s) => s.friends);
  const incomingRequests = useFriendStore((s) => s.incomingRequests);
  const outgoingRequests = useFriendStore((s) => s.outgoingRequests);
  const searchResults = useFriendStore((s) => s.searchResults);
  const getFriends = useFriendStore((s) => s.getFriends);
  const getFriendRequests = useFriendStore((s) => s.getFriendRequests);
  const searchUsers = useFriendStore((s) => s.searchUsers);
  const sendFriendRequest = useFriendStore((s) => s.sendFriendRequest);
  const acceptFriendRequest = useFriendStore((s) => s.acceptFriendRequest);
  const rejectFriendRequest = useFriendStore((s) => s.rejectFriendRequest);
  const subscribeToFriendEvents = useFriendStore((s) => s.subscribeToFriendEvents);
  const unsubscribeFromFriendEvents = useFriendStore((s) => s.unsubscribeFromFriendEvents);
  const blockUser = useFriendStore((s) => s.blockUser);
  const reportUser = useFriendStore((s) => s.reportUser);
  const blockedUsers = useFriendStore((s) => s.blockedUsers);
  const getBlockedUsers = useFriendStore((s) => s.getBlockedUsers);

  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [isLocalCreateGroupOpen, setIsLocalCreateGroupOpen] = useState(false);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [activeLabelFilter, setActiveLabelFilter] = useState(null);
  const [showLabelsManager, setShowLabelsManager] = useState(false);
  const searchInputRef = useRef(null);
  const optionsDropdownRef = useRef(null);
  const chatMenuRef = useRef(null);
  const tabsRef = useRef(null);
  const [tabsAtStart, setTabsAtStart] = useState(true);
  const [tabsAtEnd, setTabsAtEnd] = useState(true);
  const cardLongPressTimerRef = useRef(null);
  const cardLongPressFiredRef = useRef(false);
  const [openMenuChat, setOpenMenuChat] = useState(null); // { id, chatType: 'room'|'user', name, room? }
  const [chatMenuAnchor, setChatMenuAnchor] = useState(null); // { top, bottom, left, right }

  // Close options dropdown on outside click / tap, anywhere on screen.
  // Document-level capture listener (not an overlay div): overlay divs get
  // clipped to their own pane by ancestor backdrop-filters, so taps in the
  // chat pane would never dismiss this menu.
  useEffect(() => {
    if (!showOptionsDropdown) return;
    const handlePointerDown = (e) => {
      if (optionsDropdownRef.current && !optionsDropdownRef.current.contains(e.target)) {
        setShowOptionsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("touchstart", handlePointerDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("touchstart", handlePointerDown, true);
    };
  }, [showOptionsDropdown]);

  // ---- Per-chat context menu (⋮ on desktop, long-press / right-click everywhere)
  const openChatMenu = useCallback((chat, anchor) => {
    cardLongPressFiredRef.current = false;
    setOpenMenuChat(chat);
    setChatMenuAnchor(anchor);
  }, []);

  const closeChatMenu = useCallback(() => {
    setOpenMenuChat(null);
    setChatMenuAnchor(null);
  }, []);

  useBackHandler(!!openMenuChat, closeChatMenu, "sidebar-chat-menu");

  const getChatMenuStyle = () => {
    const menuWidth = 248;
    const menuHeight = 360;
    const padding = 12;
    const winWidth = typeof window !== "undefined" ? window.innerWidth : 400;
    const winHeight = typeof window !== "undefined" ? window.innerHeight : 700;
    let left = chatMenuAnchor ? chatMenuAnchor.left : winWidth - menuWidth - padding;
    left = Math.max(padding, Math.min(left, winWidth - menuWidth - padding));
    let top;
    if (chatMenuAnchor) {
      const spaceBelow = winHeight - chatMenuAnchor.bottom;
      top = spaceBelow >= menuHeight + 12
        ? chatMenuAnchor.bottom + 6
        : chatMenuAnchor.top - menuHeight - 6;
    } else {
      top = padding;
    }
    top = Math.max(padding, Math.min(top, winHeight - menuHeight - padding));
    return {
      position: "fixed",
      left: `${left}px`,
      top: `${top}px`,
      width: `${menuWidth}px`,
      zIndex: 99999,
      maxHeight: `min(${menuHeight}px, calc(100vh - 24px))`,
      overflowY: "auto",
    };
  };

  const startCardLongPress = (e, chat) => {
    if (e.target.closest("button, a, input, textarea, select")) return;
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    cardLongPressFiredRef.current = false;
    if (cardLongPressTimerRef.current) clearTimeout(cardLongPressTimerRef.current);
    cardLongPressTimerRef.current = setTimeout(() => {
      cardLongPressFiredRef.current = true;
      try {
        window.navigator?.vibrate?.(30);
      } catch {}
      openChatMenu(chat, { left: x, right: x, top: y, bottom: y });
    }, 500);
  };

  const cancelCardLongPress = () => {
    if (cardLongPressTimerRef.current) {
      clearTimeout(cardLongPressTimerRef.current);
      cardLongPressTimerRef.current = null;
    }
  };

  const guardCardClick = (e) => {
    if (cardLongPressFiredRef.current) {
      e.preventDefault();
      e.stopPropagation();
      setTimeout(() => {
        cardLongPressFiredRef.current = false;
      }, 300);
    }
  };

  const openChatMenuAtCursor = (e, chat) => {
    e.preventDefault();
    e.stopPropagation();
    openChatMenu(chat, {
      left: e.clientX,
      right: e.clientX,
      top: e.clientY,
      bottom: e.clientY,
    });
  };

  const toggleMenuLabel = async (labelId) => {
    if (!openMenuChat) return;
    const current = chatLabels[openMenuChat.id] || [];
    const next = current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId];
    await setChatLabels(openMenuChat.id, next);
  };

  const handleMenuBlock = async () => {
    if (!openMenuChat || openMenuChat.chatType !== "user") return;
    if (!window.confirm(`Block ${openMenuChat.name}? You will stop receiving their messages and they won't see you online.`)) return;
    await blockUser(openMenuChat.id);
    closeChatMenu();
  };

  const handleMenuReport = async () => {
    if (!openMenuChat || openMenuChat.chatType !== "user") return;
    const reason = window.prompt(`Report ${openMenuChat.name} for spam or abuse (optional reason):`, "");
    if (reason === null) return;
    await reportUser(openMenuChat.id, reason);
    closeChatMenu();
  };

  // ---- Filter-tabs overflow: arrows + mouse-wheel support for laptop
  // The tabs strip hides its scrollbar, so without affordances laptop users
  // can never reach overflowed tabs (e.g. Archived). Track both ends and
  // translate vertical wheel motion into horizontal scrolling.
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const update = () => {
      setTabsAtStart(el.scrollLeft <= 4);
      setTabsAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      if (ro) ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      if ((e.deltaY > 0 && el.scrollLeft < max - 1) || (e.deltaY < 0 && el.scrollLeft > 1)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const scrollTabs = (dir) => {
    const el = tabsRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  // Mobile Back Navigation handlers
  useBackHandler(isLocalCreateGroupOpen, () => setIsLocalCreateGroupOpen(false), "sidebar-create-group");
  useBackHandler(showOptionsDropdown, () => setShowOptionsDropdown(false), "sidebar-options-dropdown");
  useBackHandler(showLabelsManager, () => setShowLabelsManager(false), "sidebar-labels-manager");

  useEffect(() => {
    getRooms();
    getFriends();
    getFriendRequests();
    getLabels();
    getBlockedUsers();
    subscribeToFriendEvents();
    return () => {
      unsubscribeFromFriendEvents();
    };
  }, [getRooms, getFriends, getFriendRequests, getLabels, getBlockedUsers, subscribeToFriendEvents, unsubscribeFromFriendEvents, socket]);

  // Keyboard shortcut: Command+K or Ctrl+K focuses the search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAcceptRequest = async (requestId) => {
    setActionLoadingId(requestId);
    await acceptFriendRequest(requestId);
    setActionLoadingId(null);
  };

  const handleRejectRequest = async (requestId) => {
    setActionLoadingId(requestId);
    await rejectFriendRequest(requestId);
    setActionLoadingId(null);
  };

  const handleSendRequest = async (userId) => {
    setActionLoadingId(userId);
    await sendFriendRequest(userId);
    setActionLoadingId(null);
  };

  const selectChat = (chat) => {
    setSelectedChat(chat);
    onChatSelect?.();
  };

  // Unified search (WhatsApp-style): the main bar filters chats AND searches
  // message text across every conversation in one debounced pass.
  const [searchMediaOnly, setSearchMediaOnly] = useState(false);
  const [searchFrom, setSearchFrom] = useState("");
  const [searchTo, setSearchTo] = useState("");
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length >= 2) {
      const timer = setTimeout(() => {
        searchUsers(searchQuery);
        searchMessages({
          query: q,
          ...(searchMediaOnly ? { hasMedia: true } : {}),
          ...(searchFrom ? { from: searchFrom } : {}),
          ...(searchTo ? { to: searchTo } : {}),
        });
      }, 400);
      return () => clearTimeout(timer);
    }
    clearGlobalSearch();
  }, [searchQuery, searchUsers, searchMessages, clearGlobalSearch, searchMediaOnly, searchFrom, searchTo]);

  // Drop stale message results when the sidebar unmounts
  useEffect(() => {
    return () => clearGlobalSearch();
  }, [clearGlobalSearch]);

  const pendingCount = incomingRequests?.length || 0;
  const onlineUsersSet = useMemo(() => new Set(onlineUsers || []), [onlineUsers]);

  // Clean groups: exclude Discord seed groups
  const filteredRooms = useMemo(() => {
    const nonDiscord = (rooms || []).filter((r) => {
      const name = (r.name || "").toLowerCase().trim();
      return (
        name !== "#announcements" &&
        name !== "announcements" &&
        name !== "#dev-hangout" &&
        name !== "dev-hangout"
      );
    });
    const q = searchQuery.toLowerCase().trim();
    if (!q) return nonDiscord;
    return nonDiscord.filter((r) => r.name.toLowerCase().includes(q));
  }, [rooms, searchQuery]);

  const filteredFriends = useMemo(() => {
    const allKnownUsers = new Map();
    
    // Add all friends
    (friends || []).forEach(f => {
      if (f && f._id) allKnownUsers.set(f._id, f);
    });

    // Add any user from `users` that we have a chat history with
    (users || []).forEach(u => {
      if (u && u._id && lastMessages[u._id] && !allKnownUsers.has(u._id)) {
        allKnownUsers.set(u._id, u);
      }
    });

    const chatList = Array.from(allKnownUsers.values());
    const q = searchQuery.toLowerCase().trim();
    if (!q) return chatList;
    return chatList.filter((f) => f.username.toLowerCase().includes(q));
  }, [friends, users, lastMessages, searchQuery]);

  // Sort helper by recent message
  const getChatTimestamp = (item) => {
    const lastMsg = lastMessages[item._id] || item.lastMessage;
    if (lastMsg?.createdAt) {
      const time = new Date(lastMsg.createdAt).getTime();
      if (!isNaN(time) && time > 0) return time;
    }
    if (item.updatedAt) {
      const time = new Date(item.updatedAt).getTime();
      if (!isNaN(time) && time > 0) return time;
    }
    if (item.createdAt) {
      const time = new Date(item.createdAt).getTime();
      if (!isNaN(time) && time > 0) return time;
    }
    return 0;
  };

  // Sorted lists by recent activity
  const sortedRooms = useMemo(() => {
    return [...filteredRooms].sort((a, b) => getChatTimestamp(b) - getChatTimestamp(a));
  }, [filteredRooms, lastMessages]);

  const sortedFriends = useMemo(() => {
    return [...filteredFriends].sort((a, b) => getChatTimestamp(b) - getChatTimestamp(a));
  }, [filteredFriends, lastMessages]);

  // Unified all chats stream (Groups + Direct combined, sorted by recent messages)
  const allChats = useMemo(() => {
    const roomItems = filteredRooms.map((r) => ({ ...r, chatType: "room" }));
    const friendItems = filteredFriends.map((f) => ({ ...f, chatType: "user" }));

    // Add Saved Messages (Self Chat)
    if (authUser && !friendItems.some((f) => f._id?.toString() === authUser._id?.toString())) {
      friendItems.push({
        ...authUser,
        chatType: "user",
        isSelfChat: true,
      });
    }

    return [...roomItems, ...friendItems].sort((a, b) => getChatTimestamp(b) - getChatTimestamp(a));
  }, [filteredRooms, filteredFriends, lastMessages, authUser]);

  // Compute Unread lists
  const unreadChats = useMemo(() => {
    return allChats.filter((c) => {
      const u = unreadCounts[c._id] !== undefined ? unreadCounts[c._id] : (c.unreadCount || 0);
      return u > 0;
    });
  }, [allChats, unreadCounts]);

  const visibleChatsList = useMemo(() => {
    return allChats.filter(c => {
      const chatId = (c._id || c.id)?.toString();
      const isArchived = archivedChats.includes(chatId);
      if (activeFilter === "archived") {
        if (isArchived && activeLabelFilter) {
          return (chatLabels[chatId] || []).includes(activeLabelFilter);
        }
        return isArchived;
      }
      // Archived chats are hidden from all other views
      if (isArchived) return false;
      if (activeLabelFilter) {
        return (chatLabels[chatId] || []).includes(activeLabelFilter);
      }
      return true;
    });
  }, [allChats, archivedChats, activeFilter, activeLabelFilter, chatLabels]);

  const totalUnreadCount = unreadChats.length;
  const roomsCount = filteredRooms.length;
  const directCount = filteredFriends.length;
  const allCount = roomsCount + directCount;

  const topPendingRequest = incomingRequests && incomingRequests.length > 0 ? incomingRequests[0] : null;

  const handleOpenGroupModal = () => {
    if (onOpenCreateGroup) {
      onOpenCreateGroup();
    } else {
      setIsLocalCreateGroupOpen(true);
    }
  };

  const renderRoomCard = (room) => {
    const roomId = (room._id || room.id)?.toString();
    const isSelected = (selectedChat?.id || selectedChat?._id)?.toString() === roomId;
    const unread = unreadCounts[roomId] !== undefined ? unreadCounts[roomId] : (room.unreadCount || 0);
    const lastMsg = lastMessages[roomId] || room.lastMessage;
    const timeStr = lastMsg?.createdAt ? formatTimeRelative(lastMsg.createdAt) : "";
    const previewText = getMessageSnippet(lastMsg);
    const authUserId = authUser?._id?.toString();
    const msgSenderId = (lastMsg?.senderId?._id || lastMsg?.senderId)?.toString();
    const isOutgoing = msgSenderId === authUserId;
    const senderUsername = isOutgoing ? "You" : lastMsg?.senderId?.username || "";
    const typers = (typingUsers[roomId] || []).filter((u) => u && u !== authUser?.username);
    const isTyping = typers.length > 0;
    const draftText = drafts[roomId];

    const menuChat = { id: roomId, chatType: "room", name: room.name?.replace(/^#/, ""), room };

    return (
      <div
        key={`room-${roomId}`}
        onClick={() =>
          selectChat({
            id: roomId,
            _id: room._id || roomId,
            name: room.name,
            type: "room",
            description: room.description,
            members: room.members,
            createdBy: room.createdBy,
            admins: room.admins,
            avatar: room.avatar,
            profilePic: room.profilePic,
          })
        }
        onClickCapture={guardCardClick}
        onContextMenu={(e) => openChatMenuAtCursor(e, menuChat)}
        onTouchStart={(e) => startCardLongPress(e, menuChat)}
        onTouchMove={cancelCardLongPress}
        onTouchEnd={cancelCardLongPress}
        onTouchCancel={cancelCardLongPress}
        className={`group relative flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all duration-150 ${
          isSelected
            ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-lg font-semibold border border-transparent"
            : "hover:bg-black/5 text-zinc-800 hover:text-zinc-950 dark:hover:bg-white/5 dark:text-zinc-300 dark:hover:text-white border border-transparent"
        }`}
      >
        <button
          type="button"
          title="Chat options"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            openChatMenu(menuChat, { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right });
          }}
          className="hidden md:flex absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 items-center justify-center rounded-full bg-black/10 dark:bg-white/10 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity z-10 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
        >
          <span className="material-symbols-outlined text-lg">more_vert</span>
        </button>
        <div
          className={`relative shrink-0 flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-150 ${
            isSelected
              ? "bg-white text-zinc-900 dark:bg-[#0d0c11] dark:text-white shadow-md font-bold scale-105"
              : "bg-black/5 border border-black/10 text-zinc-600 group-hover:text-zinc-900 group-hover:scale-105 dark:bg-white/5 dark:border-white/10 dark:text-zinc-400 dark:group-hover:text-white"
          }`}
        >
          <span className="material-symbols-outlined text-xl">groups</span>
        </div>

        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-1 min-w-0">
              <span
                className={`text-xs font-semibold truncate ${
                  isSelected ? "text-white dark:text-[#0d0c11] font-bold" : "text-zinc-900 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white"
                }`}
              >
                {room.name.replace(/^#/, "")}
              </span>
              <ChatLabelDots chatId={roomId} />
            </div>

            <div className={`flex items-center gap-1 text-[11px] truncate mt-0.5 ${isSelected ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400"}`}>
              {isTyping ? (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold animate-fadeIn min-w-0">
                  <span className="truncate">{typers.join(", ")} {typers.length === 1 ? "is" : "are"} typing</span>
                  <span className="inline-flex items-center gap-0.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-typing-dot-1" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-typing-dot-2" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-typing-dot-3" />
                  </span>
                </div>
              ) : draftText ? (
                <div className="flex items-center gap-1 min-w-0 truncate">
                  <span className="text-red-500 font-bold shrink-0">[Draft]</span>
                  <span className="truncate text-zinc-900 dark:text-white font-medium">{draftText}</span>
                </div>
              ) : previewText ? (
                <>
                  {isOutgoing && (
                    <span className={`material-symbols-outlined text-[13px] shrink-0 ${isSelected ? "text-white dark:text-black" : "text-zinc-400"}`}>
                      done
                    </span>
                  )}
                  {senderUsername && (
                    <span className={`font-medium shrink-0 ${isSelected ? "text-white dark:text-black" : "text-zinc-700 dark:text-zinc-300"}`}>
                      {senderUsername}:
                    </span>
                  )}
                  <span className="truncate">{previewText}</span>
                </>
              ) : (
                <span className="truncate opacity-75">{room.description || "Group chat"}</span>
              )}
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-end justify-center self-stretch gap-1 text-right">
            <span className={`text-[10px] font-mono leading-none ${isSelected ? "text-zinc-300 dark:text-zinc-600 font-medium" : "text-zinc-400 dark:text-zinc-500"}`}>
              {timeStr || "Active"}
            </span>
            {unread > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow-sm animate-pulse ${
                  isSelected ? "bg-white text-zinc-900 dark:bg-black dark:text-white" : "bg-zinc-900 text-white dark:bg-white dark:text-black"
                }`}
              >
                {unread}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFriendCard = (friend) => {
    const friendId = (friend._id || friend.id)?.toString();
    const authUserId = authUser?._id?.toString();
    const isSelfChat = friend.isSelfChat || friendId === authUserId;
    const isSelected = (selectedChat?.id || selectedChat?._id)?.toString() === friendId;
    const isOnline = isSelfChat
      ? true
      : onlineUsersSet.has(friendId) &&
        !(blockedUsers || []).some((b) => (b._id || b)?.toString() === friendId);
    const unread = unreadCounts[friendId] !== undefined ? unreadCounts[friendId] : (friend.unreadCount || 0);
    const lastMsg = lastMessages[friendId] || friend.lastMessage;
    const timeStr = lastMsg?.createdAt ? formatTimeRelative(lastMsg.createdAt) : "";
    const previewText = getMessageSnippet(lastMsg);
    const msgSenderId = (lastMsg?.senderId?._id || lastMsg?.senderId)?.toString();
    const isOutgoing = msgSenderId === authUserId;
    const isRead = lastMsg && ((lastMsg.reads || []).some(r => (r.userId?._id || r.userId)?.toString() === friendId) || (lastMsg.readBy || []).some(id => (id?._id || id)?.toString() === friendId));
    const isDelivered = lastMsg && (lastMsg.deliveries || []).some(d => (d.userId?._id || d.userId)?.toString() === friendId);
    const typers = (typingUsers[friendId] || []).filter((u) => u && u !== authUser?.username);
    const isTyping = typers.length > 0;
    const draftText = drafts[friendId];

    const menuChat = {
      id: friendId,
      chatType: "user",
      name: isSelfChat ? "Saved Messages" : friend.username,
    };

    return (
      <div
        key={`friend-${friendId}`}
        onClick={() =>
          selectChat({
            id: friendId,
            name: isSelfChat ? "Saved Messages" : friend.username,
            type: "user",
            profilePic: friend.profilePic,
          })
        }
        onClickCapture={guardCardClick}
        onContextMenu={(e) => openChatMenuAtCursor(e, menuChat)}
        onTouchStart={(e) => startCardLongPress(e, menuChat)}
        onTouchMove={cancelCardLongPress}
        onTouchEnd={cancelCardLongPress}
        onTouchCancel={cancelCardLongPress}
        className={`group relative flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all duration-150 ${
          isSelected
            ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-lg font-semibold border border-transparent"
            : "hover:bg-black/5 text-zinc-800 hover:text-zinc-950 dark:hover:bg-white/5 dark:text-zinc-300 dark:hover:text-white border border-transparent"
        }`}
      >
        <button
          type="button"
          title="Chat options"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            openChatMenu(menuChat, { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right });
          }}
          className="hidden md:flex absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 items-center justify-center rounded-full bg-black/10 dark:bg-white/10 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity z-10 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
        >
          <span className="material-symbols-outlined text-lg">more_vert</span>
        </button>
        <div className="relative shrink-0 w-10 h-10">
          <img
            className="w-full h-full rounded-full object-cover bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
            alt={isSelfChat ? "Saved Messages" : friend.username}
            src={
              isSelfChat
                ? friend.profilePic || `https://ui-avatars.com/api/?name=Saved&background=3b82f6&color=ffffff`
                : friend.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username)}&background=27272a&color=ffffff`
            }
          />
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white dark:ring-[#121117] z-10 ${
              isOnline
                ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                : "bg-zinc-400 dark:bg-zinc-600"
            }`}
          />
        </div>

        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-1 min-w-0">
              <span
                className={`text-xs font-semibold truncate ${
                  isSelected ? "text-white dark:text-[#0d0c11] font-bold" : "text-zinc-900 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white"
                }`}
              >
                {isSelfChat ? (
                  <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">bookmark</span>Saved Messages (You)</div>
                ) : (
                  friend.username
                )}
              </span>
              <ChatLabelDots chatId={friendId} />
            </div>

            <div className={`flex items-center gap-1 text-[11px] truncate mt-0.5 ${isSelected ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400"}`}>
              {isTyping ? (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold animate-fadeIn min-w-0">
                  <span>typing</span>
                  <span className="inline-flex items-center gap-0.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-typing-dot-1" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-typing-dot-2" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-typing-dot-3" />
                  </span>
                </div>
              ) : draftText ? (
                <div className="flex items-center gap-1 min-w-0 truncate">
                  <span className="text-red-500 font-bold shrink-0">[Draft]</span>
                  <span className="truncate text-zinc-900 dark:text-white font-medium">{draftText}</span>
                </div>
              ) : previewText ? (
                <>
                  {isOutgoing && (
                    <MessageTicks
                      status={isRead ? "read" : isDelivered ? "delivered" : "sent"}
                      size={13}
                      className={isSelected ? "text-white dark:text-black" : "text-zinc-400"}
                    />
                  )}
                  <span className="truncate">{previewText}</span>
                </>
              ) : (
                <span className="truncate opacity-75">{isOnline ? "Online" : "Offline"}</span>
              )}
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-end justify-center self-stretch gap-1 text-right">
            <span className={`text-[10px] font-mono leading-none ${isSelected ? "text-zinc-300 dark:text-zinc-600 font-medium" : "text-zinc-400 dark:text-zinc-500"}`}>
              {timeStr || (isOnline ? "Online" : "")}
            </span>
            {unread > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow-sm animate-pulse ${
                  isSelected ? "bg-white text-zinc-900 dark:bg-black dark:text-white" : "bg-zinc-900 text-white dark:bg-white dark:text-black"
                }`}
              >
                {unread}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderChatCard = (item) => {
    if (item.chatType === "room") {
      return renderRoomCard(item);
    }
    return renderFriendCard(item);
  };

  return (
    <section
      aria-label="Chats List"
      className="h-full flex flex-col p-3 text-on-surface select-none overflow-hidden transition-colors duration-200 bg-transparent"
    >
      {/* 1. Sleek Top Header Bar with Actions */}
      <div className="flex flex-col gap-2 pb-2">
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2.5">
            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                className="md:hidden relative shrink-0 w-8 h-8 active:scale-95 transition-transform cursor-pointer"
                title="Open Profile & Status"
              >
                <img
                  src={
                    authUser?.profilePic ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.username || "User")}&background=27272a&color=ffffff&bold=true`
                  }
                  alt={authUser?.username || "User"}
                  className="w-full h-full rounded-full object-cover border border-black/10 dark:border-white/15"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#121117] z-10" />
              </button>
            )}
            <div className="flex items-center cursor-pointer" onClick={() => setSelectedChat(null)}>
              <h1 className="font-bold tracking-tight text-zinc-900 dark:text-white text-xl leading-tight">Chats</h1>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* 24-Hour Status Stories Button (Mobile Only) */}
            {onOpenStatus && (
              <button
                onClick={onOpenStatus}
                className="md:hidden p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
                title="Status Stories"
                type="button"
              >
                <span className="material-symbols-outlined text-xl">motion_photos_on</span>
              </button>
            )}

            {/* New Group Button (Mobile Only) */}
            <button
              onClick={handleOpenGroupModal}
              className="md:hidden p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
              title="New Group"
              type="button"
            >
              <span className="material-symbols-outlined text-xl">group_add</span>
            </button>

            {/* Add Contact Button (Mobile Only) */}
            <button
              onClick={onOpenAddFriend}
              className="md:hidden relative p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
              title="Add Contact"
              type="button"
            >
              <span className="material-symbols-outlined text-xl">person_add</span>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black font-mono text-[9px] font-bold shadow-md animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>

            {/* Options Dropdown Menu */}
            <div className="relative" ref={optionsDropdownRef}>
              <button
                onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
                className="p-2 md:p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
                title="More options"
                type="button"
              >
                <span className="material-symbols-outlined text-xl md:text-lg">more_vert</span>
              </button>

              {showOptionsDropdown && (
                <div className="absolute right-0 top-9 z-50 w-56 max-w-[calc(100vw-1rem)] rounded-2xl overflow-hidden bg-[rgb(var(--bg-surface-rgb))] border border-[var(--glass-border)] shadow-glass py-1.5 animate-scaleIn select-none text-[13px]">
                  {onOpenProfile && (
                    <button
                      onClick={() => { onOpenProfile(); setShowOptionsDropdown(false); }}
                      className="md:hidden w-full flex items-center gap-2.5 px-3.5 py-2.5 text-theme-main hover:bg-[var(--glass-hover)] hover:text-accent-primary transition-colors text-left text-xs font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px] text-accent-primary">person</span>
                      <span>My Profile</span>
                    </button>
                  )}
                  {onOpenStarred && (
                    <button
                      onClick={() => { onOpenStarred(); setShowOptionsDropdown(false); }}
                      className="md:hidden w-full flex items-center gap-2.5 px-3.5 py-2.5 text-theme-main hover:bg-[var(--glass-hover)] hover:text-accent-primary transition-colors text-left text-xs font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px] text-accent-primary">star</span>
                      <span>Starred Messages</span>
                    </button>
                  )}
                  {onOpenSetStatus && (
                    <button
                      onClick={() => { onOpenSetStatus(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-theme-main hover:bg-[var(--glass-hover)] hover:text-accent-primary transition-colors text-left text-xs font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px] text-accent-primary">sentiment_satisfied</span>
                      <span>Set Status Mood</span>
                    </button>
                  )}
                  {handleInstallPWA && (
                    <button
                      onClick={() => { handleInstallPWA(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-theme-main hover:bg-[var(--glass-hover)] hover:text-accent-primary transition-colors text-left text-xs font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px] text-accent-primary">install_desktop</span>
                      <span>Install Pulse PWA</span>
                    </button>
                  )}
                  {onOpenJoinGroup && (
                    <button
                      onClick={() => { onOpenJoinGroup(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-theme-main hover:bg-[var(--glass-hover)] hover:text-accent-primary transition-colors text-left text-xs font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px] text-accent-primary">ticket</span>
                      <span>Join Group with Code</span>
                    </button>
                  )}
                  {onOpenBroadcast && (
                    <button
                      onClick={() => { onOpenBroadcast(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-theme-main hover:bg-[var(--glass-hover)] hover:text-accent-primary transition-colors text-left text-xs font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px] text-accent-primary">campaign</span>
                      <span>Broadcast Lists</span>
                    </button>
                  )}
                  {onOpenCalls && (
                    <button
                      onClick={() => { onOpenCalls(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-theme-main hover:bg-[var(--glass-hover)] hover:text-accent-primary transition-colors text-left text-xs font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px] text-accent-primary">call_log</span>
                      <span>Call History</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsSettingsOpen(true);
                      setShowOptionsDropdown(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-theme-main hover:bg-[var(--glass-hover)] hover:text-accent-primary transition-colors text-left text-xs font-medium cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-accent-primary">settings</span>
                    <span>Settings & Animations</span>
                  </button>

                  {logout && (
                    <>
                      <div className="my-1 border-t border-[var(--glass-border)]" />
                      <button
                        onClick={() => { logout(); setShowOptionsDropdown(false); }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-red-500 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-[16px]">logout</span>
                        <span>Sign Out</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Bar with ⌘K */}
        <div className="relative flex items-center w-full mt-1">
          <span className="material-symbols-outlined absolute left-3 text-zinc-400 dark:text-zinc-500 pointer-events-none text-base">
            search
          </span>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 sm:pr-11 py-2 rounded-full text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400/50 dark:focus:ring-white/40 transition-all bg-black/[0.04] dark:bg-white/5 border border-black/10 dark:border-white/10"
            placeholder="Search or start new chat..."
            type="text"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 p-0.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors"
              title="Clear search"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          ) : (
            <kbd className="hidden sm:inline-block absolute right-3 px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-zinc-500 dark:text-zinc-400 font-mono text-[9px] pointer-events-none">
              ⌘K
            </kbd>
          )}
        </div>

        {/* Category Filter Tabs: All, Unread, Requests, Groups, Direct */}
        <div className="relative select-none">
          <div ref={tabsRef} className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1.5 pb-1">
            <button
              onClick={() => setActiveFilter("all")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === "all"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5"
            }`}
            type="button"
          >
            <span>All</span>
            <span className="text-[10px] opacity-75 font-mono">({allCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter("unread")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === "unread"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5"
            }`}
            type="button"
          >
            <span>Unread</span>
            {totalUnreadCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                activeFilter === "unread"
                  ? "bg-white text-zinc-900 dark:bg-black dark:text-white"
                  : "bg-zinc-900 text-white dark:bg-white dark:text-black"
              }`}>
                {totalUnreadCount}
              </span>
            )}
          </button>

          {pendingCount > 0 && (
            <button
              onClick={() => setActiveFilter("requests")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
                activeFilter === "requests"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-md font-bold"
                  : "text-zinc-900 bg-black/5 border border-black/10 hover:bg-black/10 dark:text-white dark:bg-white/10 dark:border-white/20 dark:hover:bg-white/20 font-semibold"
              }`}
              type="button"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-white animate-pulse" />
              <span>Requests</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                activeFilter === "requests"
                  ? "bg-white text-zinc-900 dark:bg-black dark:text-white"
                  : "bg-zinc-900 text-white dark:bg-white dark:text-black"
              }`}>
                {pendingCount}
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveFilter("groups")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === "groups"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5"
            }`}
            type="button"
          >
            <span>Groups</span>
            <span className="text-[10px] opacity-75 font-mono">({roomsCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter("direct")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === "direct"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5"
            }`}
            type="button"
          >
            <span>Direct</span>
            <span className="text-[10px] opacity-75 font-mono">({directCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter("archived")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === "archived"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5"
            }`}
            type="button"
          >
            <span>Archived</span>
          </button>
          </div>
          {!tabsAtStart && (
            <>
              <div
                className="absolute left-0 top-0 bottom-0 w-7 pointer-events-none"
                style={{ background: "linear-gradient(to right, rgb(var(--bg-sidebar-rgb)), transparent)" }}
              />
              <button
                type="button"
                onClick={() => scrollTabs(-1)}
                title="Scroll tabs left"
                className="absolute left-0 top-0 bottom-0 w-7 hidden md:flex items-center justify-start text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-xl drop-shadow">chevron_left</span>
              </button>
            </>
          )}
          {!tabsAtEnd && (
            <>
              <div
                className="absolute right-0 top-0 bottom-0 w-7 pointer-events-none"
                style={{ background: "linear-gradient(to left, rgb(var(--bg-sidebar-rgb)), transparent)" }}
              />
              <button
                type="button"
                onClick={() => scrollTabs(1)}
                title="More filters — scroll right"
                className="absolute right-0 top-0 bottom-0 w-7 hidden md:flex items-center justify-end animate-fadeIn text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-xl drop-shadow">chevron_right</span>
              </button>
            </>
          )}
        </div>

        {/* Label folders toolbar */}
        <div className="flex items-center gap-1.5 pt-1 pb-0.5 select-none">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 min-w-0">
            {(labels || []).map((label) => {
              const active = activeLabelFilter === label._id;
              return (
                <button
                  key={label._id}
                  onClick={() => setActiveLabelFilter(active ? null : label._id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold shrink-0 border transition-all ${
                    active
                      ? "border-accent-primary bg-accent-primary/15 text-accent-primary"
                      : "border-black/10 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:text-theme-main"
                  }`}
                  type="button"
                  title={`Show chats labeled ${label.name}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: label.color }} />
                  <span className="max-w-[80px] truncate">{label.name}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setShowLabelsManager(true)}
            className="p-1.5 rounded-full text-zinc-500 hover:text-theme-main hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10 transition-colors shrink-0"
            type="button"
            title="Manage labels"
          >
            <span className="material-symbols-outlined text-[16px]">label</span>
          </button>
        </div>
        {activeLabelFilter && (
          <div className="flex items-center justify-between px-1 pt-0.5 text-[11px] text-theme-muted">
            <span className="truncate">
              Filtered by {(labels || []).find((l) => l._id === activeLabelFilter)?.name || "label"}
            </span>
            <button type="button" onClick={() => setActiveLabelFilter(null)} className="text-accent-primary font-semibold shrink-0 ml-2">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* 2. Pending Friend Requests Banner List */}
      {incomingRequests && incomingRequests.length > 0 && (
        <div className="my-2 p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 dark:border-white/20 backdrop-blur-xl shadow-glass flex flex-col gap-2 shrink-0 animate-fadeIn">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-white animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                Friend Requests ({incomingRequests.length})
              </span>
            </div>
            {onOpenAddFriend && (
              <button
                type="button"
                onClick={onOpenAddFriend}
                className="text-[10px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
              >
                View all
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
            {incomingRequests.map((req) => {
              const sender = req.sender || {};
              const isLoading = actionLoadingId === req._id;

              return (
                <div
                  key={req._id}
                  className="p-2 rounded-xl bg-black/[0.02] border border-black/10 hover:bg-black/[0.05] dark:bg-white/[0.04] dark:border-white/10 dark:hover:bg-white/[0.08] transition-all flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      className="w-8 h-8 rounded-full object-cover shrink-0 border border-black/10 dark:border-white/10"
                      alt={sender.username || "Contact"}
                      src={
                        sender.profilePic ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          sender.username || "User"
                        )}&background=27272a&color=ffffff`
                      }
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold truncate text-zinc-900 dark:text-white">
                        {sender.username || "Unknown User"}
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                        {sender.status || "Wants to connect"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAcceptRequest(req._id)}
                      disabled={isLoading}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-black text-[11px] font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 shadow-sm flex items-center gap-1 cursor-pointer"
                      title="Accept Request"
                    >
                      <span className="material-symbols-outlined text-xs">check</span>
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectRequest(req._id)}
                      disabled={isLoading}
                      className="p-1 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-red-500/10 dark:text-zinc-400 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Decline"
                    >
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Global User Search Results (When typing) */}
      {searchQuery.trim().length >= 2 && searchResults.length > 0 && (
        <div className="mb-2 p-2 rounded-2xl bg-white/95 dark:bg-[#14131a]/90 border border-black/10 dark:border-white/10 shadow-xl flex flex-col gap-1 shrink-0 max-h-48 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold px-1">
            Global Search
          </div>
          {searchResults.map((user) => {
            const isAlreadyFriend = friends.some((f) => f._id?.toString() === user._id?.toString()) || user.relationship === "friend";
            const isMe = user._id?.toString() === authUser?._id?.toString() || user.relationship === "self";
            const isPendingOutgoing =
              user.relationship === "pending_outgoing" ||
              outgoingRequests?.some((r) => (r.receiver?._id || r.receiver)?.toString() === user._id?.toString());
            const isPendingIncoming =
              user.relationship === "pending_incoming" ||
              incomingRequests?.some((r) => (r.sender?._id || r.sender)?.toString() === user._id?.toString());
            const isLoading = actionLoadingId === user._id;

            return (
              <div
                key={user._id}
                onClick={() => {
                  selectChat({
                    id: user._id,
                    name: user.username,
                    type: "user",
                    avatar: user.profilePic,
                    status: user.status || "Available",
                    email: user.email,
                  });
                }}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={user.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || "User")}&background=27272a&color=ffffff`}
                    alt={user.username}
                    className="w-8 h-8 rounded-full object-cover border border-black/10 dark:border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white block truncate">{user.username}</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block truncate">{user.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                  {isMe ? (
                    <span className="text-[10px] text-zinc-500 font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5">You</span>
                  ) : isAlreadyFriend ? (
                    <button
                      type="button"
                      onClick={() => {
                        selectChat({
                          id: user._id,
                          name: user.username,
                          type: "user",
                          avatar: user.profilePic,
                          status: user.status || "Available",
                          email: user.email,
                        });
                      }}
                      className="px-2.5 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black text-[11px] font-bold shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 flex items-center gap-1"
                      title="Open conversation"
                    >
                      <span className="material-symbols-outlined text-xs">chat</span>
                      <span>Chat</span>
                    </button>
                  ) : isPendingOutgoing ? (
                    <div className="px-2.5 py-1 rounded-full bg-black/5 border border-black/10 dark:bg-white/10 dark:border-white/20 text-zinc-600 dark:text-zinc-300 text-[10px] font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-zinc-900 dark:text-white">done</span>
                      <span>Sent</span>
                    </div>
                  ) : isPendingIncoming ? (
                    <button
                      type="button"
                      onClick={() => {
                        const req = incomingRequests.find((r) => (r.sender?._id || r.sender) === user._id);
                        if (req) handleAcceptRequest(req._id);
                      }}
                      disabled={isLoading}
                      className="px-2.5 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black text-[11px] font-bold shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 flex items-center gap-1"
                      title="Accept request"
                    >
                      <span className="material-symbols-outlined text-xs">check</span>
                      <span>Accept</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleSendRequest(user._id);
                      }}
                      disabled={isLoading}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Send Contact Request"
                    >
                      {isLoading ? (
                        <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-xs">person_add</span>
                      )}
                      <span>Add</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3b. Matching messages across all chats (unified search) */}
      {searchQuery.trim().length >= 2 && (isGlobalSearchLoading || globalSearchResults.length > 0) && (
        <div className="mb-2 p-2 rounded-2xl bg-white/95 dark:bg-[#14131a]/90 border border-black/10 dark:border-white/10 shadow-xl flex flex-col gap-1 shrink-0 max-h-56 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold px-1 flex items-center justify-between">
            <span>Messages</span>
            <span className="flex items-center gap-1">
              {!isGlobalSearchLoading && <span>{globalSearchResults.length}</span>}
              <button
                type="button"
                onClick={() => setShowSearchFilters((v) => !v)}
                title="Message filters"
                className={`p-0.5 rounded-full transition-colors ${
                  searchMediaOnly || searchFrom || searchTo || showSearchFilters
                    ? "text-accent-primary"
                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">tune</span>
              </button>
            </span>
          </div>
          {showSearchFilters && (
            <div className="flex flex-wrap items-center gap-1.5 px-1 py-1">
              <button
                type="button"
                onClick={() => setSearchMediaOnly((v) => !v)}
                className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                  searchMediaOnly
                    ? "border-accent-primary bg-accent-primary/15 text-accent-primary"
                    : "border-black/10 dark:border-white/10 text-zinc-500 dark:text-zinc-400"
                }`}
              >
                Media
              </button>
              <input
                type="date"
                value={searchFrom}
                onChange={(e) => setSearchFrom(e.target.value)}
                title="From date"
                className="glass-input rounded-full px-2 py-1 text-[10px] text-theme-main border border-black/10 dark:border-white/10 max-w-[118px]"
              />
              <input
                type="date"
                value={searchTo}
                onChange={(e) => setSearchTo(e.target.value)}
                title="To date"
                className="glass-input rounded-full px-2 py-1 text-[10px] text-theme-main border border-black/10 dark:border-white/10 max-w-[118px]"
              />
              {(searchMediaOnly || searchFrom || searchTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchMediaOnly(false);
                    setSearchFrom("");
                    setSearchTo("");
                  }}
                  className="text-[10px] font-semibold text-accent-primary hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          )}
          {isGlobalSearchLoading && globalSearchResults.length === 0 ? (
            <div className="flex items-center justify-center py-6 gap-2 text-zinc-500 dark:text-zinc-400">
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              <span className="text-[11px]">Searching messages...</span>
            </div>
          ) : (
            globalSearchResults.map((m) => (
              <div
                key={m._id}
                onClick={() => {
                  jumpToMessage(m);
                  setSearchQuery("");
                }}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[11px] font-semibold text-accent-primary truncate">
                    {getResultChatName(m, rooms)}
                  </span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0">
                    {m.createdAt
                      ? new Date(m.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })
                      : ""}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-700 dark:text-zinc-300 truncate">
                  {getSearchSnippet(m, searchQuery)}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* 4. Conversation List */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-0.5 custom-scrollbar space-y-1">
        {/* Empty States */}
        {activeFilter === "unread" && totalUnreadCount === 0 && (
          <div className="p-8 text-center text-zinc-500 text-xs">No unread chats.</div>
        )}
        {activeFilter === "groups" && filteredRooms.length === 0 && (
          <div className="p-8 text-center text-zinc-500 text-xs">No groups found.</div>
        )}
        {activeFilter === "direct" && filteredFriends.length === 0 && (
          <div className="p-8 text-center text-zinc-500 text-xs">No direct contacts yet.</div>
        )}

        {/* Requests Tab Dedicated View */}
        {activeFilter === "requests" && (
          <div className="space-y-2 p-1">
            <div className="px-1 py-1 flex items-center justify-between text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              <span>Incoming Friend Requests</span>
              <span className="text-[9px] font-mono">{incomingRequests.length}</span>
            </div>
            {incomingRequests.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">No pending friend requests.</div>
            ) : (
              incomingRequests.map((req) => {
                const sender = req.sender || {};
                const isLoading = actionLoadingId === req._id;

                return (
                  <div
                    key={req._id}
                    className="p-3 rounded-2xl bg-black/[0.02] border border-black/10 hover:bg-black/[0.05] dark:bg-white/[0.05] dark:border-white/10 dark:hover:bg-white/[0.08] transition-all flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-black/10 dark:border-white/10 shadow-sm"
                        alt={sender.username || "User"}
                        src={
                          sender.profilePic ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            sender.username || "User"
                          )}&background=27272a&color=ffffff&bold=true`
                        }
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                          {sender.username || "Unknown User"}
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                          {sender.status || "Wants to connect"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAcceptRequest(req._id)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 shadow-sm flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xs">check</span>
                        <span>Accept</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectRequest(req._id)}
                        disabled={isLoading}
                        className="p-1.5 rounded-xl text-zinc-500 hover:text-red-500 hover:bg-red-500/10 dark:text-zinc-400 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                        title="Decline"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ALL TAB: Unified Chat Stream (Groups + Direct merged, chronologically sorted by recent activity) */}
        {activeFilter === "all" && (
          visibleChatsList.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No conversations yet. Start a chat or create a group!
            </div>
          ) : (
            visibleChatsList.map(renderChatCard)
          )
        )}

        {/* ARCHIVED TAB: Unified Chat Stream for Archived Chats */}
        {activeFilter === "archived" && (
          visibleChatsList.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No archived chats.
            </div>
          ) : (
            visibleChatsList.map(renderChatCard)
          )
        )}

        {/* UNREAD TAB: Unified Unread Stream */}
        {activeFilter === "unread" && (
          unreadChats.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No unread messages.
            </div>
          ) : (
            unreadChats.map(renderChatCard)
          )
        )}

        {/* GROUPS TAB: Only Groups sorted by recent */}
        {activeFilter === "groups" && (
          sortedRooms.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No groups found.
            </div>
          ) : (
            sortedRooms.map(renderRoomCard)
          )
        )}

        {/* DIRECT TAB: Only Direct Chats sorted by recent */}
        {activeFilter === "direct" && (
          sortedFriends.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No direct chats found.
            </div>
          ) : (
            sortedFriends.map(renderFriendCard)
          )
        )}
      </div>

      {isLocalCreateGroupOpen && <CreateGroupModal onClose={() => setIsLocalCreateGroupOpen(false)} />}
      {showLabelsManager && <LabelsManagerModal onClose={() => setShowLabelsManager(false)} />}

      {/* Per-chat context menu (⋮ / right-click / long-press) */}
      {openMenuChat && typeof document !== "undefined" && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998] bg-transparent"
            onPointerDown={closeChatMenu}
            onClick={closeChatMenu}
          />
          <div
            ref={chatMenuRef}
            style={getChatMenuStyle()}
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl bg-[rgb(var(--bg-surface-rgb))] border border-[var(--glass-border)] shadow-glass py-1.5 animate-scaleIn select-none text-[13px] max-w-[calc(100vw-24px)]"
          >
            <div className="px-3.5 pt-2 pb-1.5">
              <p className="text-xs font-bold text-theme-main truncate">{openMenuChat.name}</p>
              <p className="text-[10px] text-theme-muted">
                {openMenuChat.chatType === "room" ? "Group" : "Direct chat"}
              </p>
            </div>

            <div className="px-2 pb-1">
              <p className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-theme-muted">
                Labels
              </p>
              {(labels || []).length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowLabelsManager(true);
                    closeChatMenu();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-accent-primary hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>New label…</span>
                </button>
              ) : (
                <div className="max-h-40 overflow-y-auto custom-scrollbar">
                  {labels.map((label) => {
                    const active = (chatLabels[openMenuChat.id] || []).includes(label._id);
                    return (
                      <button
                        key={label._id}
                        type="button"
                        onClick={() => toggleMenuLabel(label._id)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-xl transition-colors text-left text-theme-main hover:bg-[var(--glass-hover)]"
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: label.color }} />
                        <span className="truncate flex-1">{label.name}</span>
                        {active && (
                          <span className="material-symbols-outlined text-[16px] text-accent-primary">check</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="h-px bg-[var(--glass-border)] my-1" />

            <div className="px-1.5 pb-1 flex flex-col">
              {(unreadCounts[openMenuChat.id] || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    markMessagesAsRead(openMenuChat.id, openMenuChat.chatType);
                    closeChatMenu();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-[16px] text-theme-muted">mark_chat_read</span>
                  <span>Mark as read</span>
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  await toggleArchiveChat(openMenuChat.id);
                  closeChatMenu();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
              >
                <span className="material-symbols-outlined text-[16px] text-theme-muted">
                  {archivedChats.includes(openMenuChat.id) ? "unarchive" : "archive"}
                </span>
                <span>{archivedChats.includes(openMenuChat.id) ? "Unarchive chat" : "Archive chat"}</span>
              </button>
              {openMenuChat.chatType === "room" && openMenuChat.room && (
                <button
                  type="button"
                  onClick={() => {
                    const room = openMenuChat.room;
                    selectChat({
                      id: openMenuChat.id,
                      _id: room._id || openMenuChat.id,
                      name: room.name,
                      type: "room",
                      description: room.description,
                      members: room.members,
                      createdBy: room.createdBy,
                      admins: room.admins,
                      avatar: room.avatar,
                      profilePic: room.profilePic,
                    });
                    setIsGroupInfoOpen(true);
                    closeChatMenu();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-[16px] text-theme-muted">info</span>
                  <span>Group info</span>
                </button>
              )}
            </div>
            {openMenuChat.chatType === "user" && openMenuChat.id !== authUser?._id && (
              <>
                <div className="h-px bg-[var(--glass-border)] my-1" />
                <div className="px-1.5 pb-1 flex flex-col">
                  <button
                    type="button"
                    onClick={handleMenuBlock}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 rounded-xl transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[16px]">block</span>
                    <span>Block {openMenuChat.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleMenuReport}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 rounded-xl transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[16px]">flag</span>
                    <span>Report spam</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </>,
        document.body
      )}
      {/* 5. Mobile bottom navigation (WhatsApp-style primary tabs).
          Rendered inside the sidebar column so it never overlaps content;
          hidden on desktop where the activity rail serves this role. */}
      <nav
        aria-label="Primary"
        className="md:hidden shrink-0 -mx-3 -mb-3 mt-2 border-t border-[var(--glass-border)] bg-[var(--glass-header)] backdrop-blur-2xl px-2 pt-1.5 grid grid-cols-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 10px)" }}
      >
        <button
          type="button"
          onClick={() => {
            setSelectedChat(null);
            setActiveFilter("all");
          }}
          className="flex flex-col items-center gap-0.5 py-1 text-zinc-900 dark:text-white active:scale-95 transition-transform"
        >
          <span className="relative flex items-center justify-center w-12 h-7 rounded-full bg-zinc-900/[0.07] dark:bg-white/10">
            <span className="material-symbols-outlined text-[20px]">chat</span>
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black font-mono text-[9px] font-bold flex items-center justify-center shadow">
                {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
              </span>
            )}
          </span>
          <span className="text-[10px] font-semibold">Chats</span>
        </button>

        {onOpenStatus && (
          <button
            type="button"
            onClick={onOpenStatus}
            className="flex flex-col items-center gap-0.5 py-1 text-zinc-500 dark:text-zinc-400 active:scale-95 transition-transform"
          >
            <span className="flex items-center justify-center w-12 h-7">
              <span className="material-symbols-outlined text-[20px]">motion_photos_on</span>
            </span>
            <span className="text-[10px] font-medium">Updates</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleOpenGroupModal}
          className="flex flex-col items-center gap-0.5 py-1 text-zinc-500 dark:text-zinc-400 active:scale-95 transition-transform"
        >
          <span className="flex items-center justify-center w-12 h-7">
            <span className="material-symbols-outlined text-[20px]">group_add</span>
          </span>
          <span className="text-[10px] font-medium">Groups</span>
        </button>

        {onOpenCalls && (
          <button
            type="button"
            onClick={onOpenCalls}
            className="flex flex-col items-center gap-0.5 py-1 text-zinc-500 dark:text-zinc-400 active:scale-95 transition-transform"
          >
            <span className="flex items-center justify-center w-12 h-7">
              <span className="material-symbols-outlined text-[20px]">call_log</span>
            </span>
            <span className="text-[10px] font-medium">Calls</span>
          </button>
        )}
      </nav>
    </section>
  );
};

export default Sidebar;


