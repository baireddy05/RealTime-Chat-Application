import { memo, useEffect, useState, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useFriendStore } from "../store/useFriendStore";
import { useCallStore } from "../store/useCallStore";
import CreateGroupModal from "./CreateGroupModal";
import LabelsManagerModal from "./LabelsManagerModal";
import ChannelsModal from "./ChannelsModal";
import MessageTicks from "./MessageTicks";
import { soundManager, CHAT_TONES } from "../lib/sound";
import { isChatLocked, isChatLockedAnywhere, setChatLocked, hasChatPin } from "../lib/chatLock";
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
  const time = date.getTime();
  if (isNaN(time)) return "";
  const now = new Date();
  const diffMs = now - date;
  if (isNaN(diffMs)) return "";
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  if (diffHours < 48) return "Yesterday";
  try {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
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
  if (msg.file) return `📎️ ${msg.file.name || "Attachment"}`;
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
  if (msg.file) return `📎️ ${msg.file.name || "File"}`;
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

const MOBILE_TABS = ["chats", "updates", "groups", "calls"];

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
  handleInstallPWA,
  logout,
}) => {
  // Selective subscriptions: this list never reads `messages`, so it must not
  // re-render on every incoming message. Whole-store subscription did that.
  const rooms = useChatStore((s) => s.rooms);
  const users = useChatStore((s) => s.users);
  const getRooms = useChatStore((s) => s.getRooms);
  const channels = useChatStore((s) => s.channels);
  const getChannels = useChatStore((s) => s.getChannels);
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
  const togglePinChat = useChatStore((s) => s.togglePinChat);
  const setChatTone = useChatStore((s) => s.setChatTone);
  const setChatLockedRemote = useChatStore((s) => s.setChatLockedRemote);
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
  const networkStatuses = useChatStore((s) => s.networkStatuses);

  // Users with stories I haven't opened yet (for presence rings)
  const [storyTick, setStoryTick] = useState(0);
  useEffect(() => {
    const bump = () => setStoryTick((t) => t + 1);
    window.addEventListener("pulse:story-viewed", bump);
    return () => window.removeEventListener("pulse:story-viewed", bump);
  }, []);
  const unviewedStoryUsers = useMemo(() => {
    let viewed = [];
    try {
      viewed = JSON.parse(localStorage.getItem("viewedStories") || "[]");
    } catch {}
    const viewedSet = new Set(viewed);
    const ids = new Set();
    (networkStatuses || []).forEach((p) => {
      if ((p.stories || []).some((s) => !viewedSet.has(s.id))) ids.add(p.id?.toString());
    });
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkStatuses, storyTick]);
  const unlockedChats = useChatStore((s) => s.unlockedChats);
  const relockChat = useChatStore((s) => s.relockChat);

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
  const [savingToneId, setSavingToneId] = useState(null);
  const [chatMenuAnchor, setChatMenuAnchor] = useState(null); // { top, bottom, left, right }
  const [showChannelsModal, setShowChannelsModal] = useState(false);

  // ---- Primary tabs shared with the desktop activity rail ----
  // Chats / Updates / Groups / Calls live on a finger-following track.
  // The same store tab drives the mobile bottom nav and the desktop rail,
  // so both shells always show the exact same four options.
  const mobileTab = useChatStore((s) => s.mobileTab);
  const setMobileTab = useChatStore((s) => s.setMobileTab);
  const mobileTabIndex = Math.max(0, MOBILE_TABS.indexOf(mobileTab));
  const [viewportW, setViewportW] = useState(0);
  const [isPagerDragging, setIsPagerDragging] = useState(false);
  const pagerViewportRef = useRef(null);
  const pagerTrackRef = useRef(null);
  const gestureRef = useRef(null); // { startX, startY, dx, locked, startT, lastX, lastT, vel }

  useEffect(() => {
    const el = pagerViewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setViewportW(el.clientWidth));
    setViewportW(el.clientWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handlePagerTouchStart = useCallback(
    (e) => {
      const t = e.touches?.[0];
      if (!t || e.touches.length !== 1) return;
      const now = performance.now();
      gestureRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        dx: 0,
        locked: null,
        lastX: t.clientX,
        lastT: now,
        vel: 0,
      };
    },
    []
  );

  const handlePagerTouchMove = useCallback(
    (e) => {
      const g = gestureRef.current;
      const t = e.touches?.[0];
      const track = pagerTrackRef.current;
      if (!g || !t || !track) return;
      if (g.locked === "v") return;
      const dx = t.clientX - g.startX;
      const dy = t.clientY - g.startY;
      if (!g.locked) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
        g.locked = Math.abs(dx) > Math.abs(dy) * 1.15 ? "h" : "v";
        if (g.locked === "v") return;
        setIsPagerDragging(true);
        cancelCardLongPress();
      }
      const now = performance.now();
      const dt = Math.max(1, now - g.lastT);
      g.vel = 0.7 * g.vel + 0.3 * ((t.clientX - g.lastX) / dt);
      g.lastX = t.clientX;
      g.lastT = now;
      // Rubber-band resistance past the first / last page
      let rdx = dx;
      if ((mobileTabIndex === 0 && dx > 0) || (mobileTabIndex === MOBILE_TABS.length - 1 && dx < 0)) {
        rdx = dx * 0.35;
      }
      g.dx = rdx;
      const w = viewportW || pagerViewportRef.current?.clientWidth || 0;
      track.style.transition = "none";
      track.style.transform = `translateX(${-mobileTabIndex * w + rdx}px)`;
    },
    [mobileTabIndex, viewportW]
  );

  const handlePagerTouchEnd = useCallback(
    (e) => {
      const g = gestureRef.current;
      gestureRef.current = null;
      if (!g || g.locked !== "h") return;
      const t = e.changedTouches?.[0];
      const dx = t ? t.clientX - g.startX : g.dx;
      const w = viewportW || pagerViewportRef.current?.clientWidth || 1;
      const distThreshold = w * 0.22;
      const flick = Math.abs(dx) > 32 && Math.abs(g.vel) > 0.45;
      let delta = 0;
      if (dx < -distThreshold || (flick && g.vel < 0)) delta = 1;
      else if (dx > distThreshold || (flick && g.vel > 0)) delta = -1;
      const next = Math.max(0, Math.min(MOBILE_TABS.length - 1, mobileTabIndex + delta));
      g.dx = 0;
      setIsPagerDragging(false);
      if (next !== mobileTabIndex) {
        setSearchQuery("");
        setMobileTab(MOBILE_TABS[next]);
      }
      // Otherwise React re-renders with dragging=false and the CSS transition
      // animates the track back to the current page (snap-back).
    },
    [mobileTabIndex, viewportW]
  );

  // Inline data for Updates / Calls tabs (no modals on mobile)
  const myStatuses = useChatStore((s) => s.myStatuses);
  const getStatuses = useChatStore((s) => s.getStatuses);
  const callHistory = useCallStore((s) => s.callHistory);
  const isCallHistoryLoading = useCallStore((s) => s.isCallHistoryLoading);
  const getCallHistory = useCallStore((s) => s.getCallHistory);
  const clearCallHistory = useCallStore((s) => s.clearCallHistory);
  const startCall = useCallStore((s) => s.startCall);

  useEffect(() => {
    if (mobileTab === "updates") getStatuses?.();
    if (mobileTab === "calls") getCallHistory?.();
  }, [mobileTab, getStatuses, getCallHistory]);

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
  useBackHandler(showChannelsModal, () => setShowChannelsModal(false), "sidebar-channels");

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

  const handleMenuLock = async () => {
    if (!openMenuChat) return;
    const chatId = openMenuChat.id;
    if (isChatLocked(chatId) || isChatLockedAnywhere(chatId, authUser?.chatPreferences, unlockedChats)) {
      // Remove the lock everywhere: local + other devices.
      setChatLocked(chatId, false);
      relockChat(chatId);
      try {
        await setChatLockedRemote(chatId, false);
      } catch {}
    } else {
      if (!hasChatPin()) {
        alert("Set a chat lock PIN first in Settings → Privacy.");
        return;
      }
      setChatLocked(chatId, true);
      relockChat(chatId);
      // Sync the lock flag so the PIN gate appears on mobile too.
      // The PIN hash itself never leaves this device.
      try {
        await setChatLockedRemote(chatId, true);
      } catch {}
    }
    closeChatMenu();
  };

  const handleMenuTone = async (toneId) => {
    if (!openMenuChat || savingToneId) return;
    const chatId = openMenuChat.id;
    const prevTone = authUser?.chatPreferences?.[chatId]?.tone || "chime";
    if (prevTone === toneId) {
      // Still preview so the user hears what the current tone sounds like.
      try {
        await soundManager.previewTone(toneId);
      } catch {}
      return;
    }
    // Audible preview even if global sounds are muted / context suspended.
    try {
      await soundManager.previewTone(toneId);
    } catch {}
    // Optimistic highlight so taps feel instant.
    const prevPrefs = authUser?.chatPreferences || {};
    try {
      if (authUser) {
        useAuthStore.setState({
          authUser: {
            ...authUser,
            chatPreferences: { ...prevPrefs, [chatId]: { ...(prevPrefs[chatId] || {}), tone: toneId } },
          },
        });
      }
    } catch {}
    setSavingToneId(toneId);
    const res = await setChatTone(chatId, toneId);
    setSavingToneId(null);
    if (!res?.success) {
      // Roll back highlight on failure so the UI never lies.
      try {
        if (useAuthStore.getState().authUser) {
          const cur = useAuthStore.getState().authUser;
          useAuthStore.setState({
            authUser: {
              ...cur,
              chatPreferences: { ...(cur.chatPreferences || {}), [chatId]: { ...((cur.chatPreferences || {})[chatId] || {}), tone: prevTone } },
            },
          });
        }
      } catch {}
      alert(`Couldn't save "${toneId}" tone: ${res?.error || "network error"}`);
    }
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
    getChannels();
    getFriends();
    getFriendRequests();
    getLabels();
    getBlockedUsers();
    subscribeToFriendEvents();
    return () => {
      unsubscribeFromFriendEvents();
    };
  }, [getRooms, getChannels, getFriends, getFriendRequests, getLabels, getBlockedUsers, subscribeToFriendEvents, unsubscribeFromFriendEvents, socket]);

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

  const openChannelChat = (room) => {
    const rid = (room._id || room.id)?.toString();
    if (!rid) return;
    selectChat({
      id: rid,
      _id: room._id || rid,
      name: room.name,
      type: "room",
      description: room.description,
      members: room.members,
      createdBy: room.createdBy,
      admins: room.admins,
      avatar: room.avatar,
      profilePic: room.profilePic,
      isChannel: true,
    });
    setShowChannelsModal(false);
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
    return nonDiscord.filter((r) => (r.name || "").toLowerCase().includes(q));
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
    return chatList.filter((f) => (f.username || f.name || "").toLowerCase().includes(q));
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

  // Pinned chats float above recent ones (WhatsApp-style), recency kept within each section
  const pinFirst = (list) => {
    const pinned = authUser?.pinnedChats || [];
    if (!pinned || pinned.length === 0) return list;
    const isPinned = (c) => pinned.includes((c._id || c.id)?.toString());
    return [...list.filter(isPinned), ...list.filter((c) => !isPinned(c))];
  };

  // Sorted lists by recent activity
  const sortedRooms = useMemo(() => {
    return pinFirst([...filteredRooms].sort((a, b) => getChatTimestamp(b) - getChatTimestamp(a)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRooms, lastMessages, authUser?.pinnedChats]);

  const sortedFriends = useMemo(() => {
    return pinFirst([...filteredFriends].sort((a, b) => getChatTimestamp(b) - getChatTimestamp(a)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredFriends, lastMessages, authUser?.pinnedChats]);

  const filteredChannels = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = channels || [];
    if (!q) return list;
    return list.filter((r) => (r.name || "").toLowerCase().includes(q));
  }, [channels, searchQuery]);

  const sortedChannels = useMemo(() => {
    return pinFirst([...filteredChannels].sort((a, b) => getChatTimestamp(b) - getChatTimestamp(a)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredChannels, lastMessages, authUser?.pinnedChats]);

  // Unified all chats stream (Groups + Direct combined, sorted by recent messages)
  const allChats = useMemo(() => {
    const roomItems = filteredRooms.map((r) => ({ ...r, chatType: "room" }));
    const channelItems = filteredChannels.map((r) => ({ ...r, chatType: "room" }));
    const friendItems = filteredFriends.map((f) => ({ ...f, chatType: "user" }));

    // Add Saved Messages (Self Chat)
    if (authUser && !friendItems.some((f) => f._id?.toString() === authUser._id?.toString())) {
      friendItems.push({
        ...authUser,
        chatType: "user",
        isSelfChat: true,
      });
    }

    return pinFirst([...roomItems, ...channelItems, ...friendItems].sort((a, b) => getChatTimestamp(b) - getChatTimestamp(a)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRooms, filteredChannels, filteredFriends, lastMessages, authUser, authUser?.pinnedChats]);

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
  const channelsCount = filteredChannels.length;
  const allCount = roomsCount + directCount + channelsCount;


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
    // Locked chats hide their contents until unlocked (PIN gate)
    const roomLocked = isChatLockedAnywhere(roomId, authUser?.chatPreferences, unlockedChats);
    const previewText = roomLocked ? "🔒 Locked chat" : getMessageSnippet(lastMsg);
    const authUserId = authUser?._id?.toString();
    const msgSenderId = (lastMsg?.senderId?._id || lastMsg?.senderId)?.toString();
    const isOutgoing = msgSenderId === authUserId;
    const senderUsername = isOutgoing ? "You" : lastMsg?.senderId?.username || "";
    const typers = (typingUsers[roomId] || []).filter((u) => u && u !== authUser?.username);
    const isTyping = typers.length > 0;
    const draftText = roomLocked ? null : drafts[roomId];

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
            isChannel: !!room.isChannel,
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
          <span className="material-symbols-outlined text-xl">{room.isChannel ? "campaign" : "groups"}</span>
        </div>

        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-1 min-w-0">
              <span
                className={`text-xs font-semibold truncate ${
                  isSelected ? "text-white dark:text-[#0d0c11] font-bold" : "text-zinc-900 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white"
                }`}
              >
                {(room.name || "Group").replace(/^#/, "")}
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
                <span className="truncate opacity-75">{room.description || (room.isChannel ? "Channel" : "Group chat")}</span>
              )}
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-end justify-center self-stretch gap-1 text-right">
            <span className={`text-[10px] font-mono leading-none flex items-center gap-1 ${isSelected ? "text-zinc-300 dark:text-zinc-600 font-medium" : "text-zinc-400 dark:text-zinc-500"}`}>
              {(authUser?.pinnedChats || []).includes(roomId) && (
                <span className="material-symbols-outlined text-[11px]">push_pin</span>
              )}
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
    // Locked chats hide their contents until unlocked (PIN gate)
    const friendLocked = isChatLockedAnywhere(friendId, authUser?.chatPreferences, unlockedChats);
    const previewText = friendLocked ? "🔒 Locked chat" : getMessageSnippet(lastMsg);
    const msgSenderId = (lastMsg?.senderId?._id || lastMsg?.senderId)?.toString();
    const isOutgoing = msgSenderId === authUserId;
    const isRead = lastMsg && ((lastMsg.reads || []).some(r => (r.userId?._id || r.userId)?.toString() === friendId) || (lastMsg.readBy || []).some(id => (id?._id || id)?.toString() === friendId));
    const isDelivered = lastMsg && (lastMsg.deliveries || []).some(d => (d.userId?._id || d.userId)?.toString() === friendId);
    const typers = (typingUsers[friendId] || []).filter((u) => u && u !== authUser?.username);
    const isTyping = typers.length > 0;
    const draftText = friendLocked ? null : drafts[friendId];

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
            className={`w-full h-full rounded-full object-cover bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 ${
              unviewedStoryUsers.has(friendId) ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-transparent" : ""
            }`}
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
            <span className={`text-[10px] font-mono leading-none flex items-center gap-1 ${isSelected ? "text-zinc-300 dark:text-zinc-600 font-medium" : "text-zinc-400 dark:text-zinc-500"}`}>
              {(authUser?.pinnedChats || []).includes(friendId) && (
                <span className="material-symbols-outlined text-[11px]">push_pin</span>
              )}
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

  const renderUpdatesTabContent = () => (
    <div className="space-y-3 p-1">
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-900 dark:text-white">Status</span>
        {onOpenStatus && (
          <button
            type="button"
            onClick={onOpenStatus}
            className="text-[11px] font-semibold text-accent-primary hover:underline"
          >
            View all
          </button>
        )}
      </div>
      <div
        onClick={onOpenStatus}
        className="flex items-center gap-3 p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 dark:border-white/10 cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
      >
        <div className="relative shrink-0">
          <img
            src={authUser?.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.username || "You")}&background=27272a&color=ffffff`}
            alt="My status"
            className="w-11 h-11 rounded-full object-cover border border-black/10 dark:border-white/10"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center ring-2 ring-white dark:ring-[#121117] text-sm font-bold leading-none">+</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-900 dark:text-white">My status</p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
            {(myStatuses || []).length > 0 ? `${myStatuses.length} update${myStatuses.length === 1 ? "" : "s"} • Tap to view` : "Tap to add status update"}
          </p>
        </div>
      </div>
      <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Recent updates
      </div>
      {(networkStatuses || []).length === 0 ? (
        <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400 bg-black/[0.02] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-2xl">
          No status updates yet. Swipe back to Chats or tap + on My status.
        </div>
      ) : (
        <div className="space-y-1">
          {(networkStatuses || []).map((person) => (
            <div
              key={person.id}
              onClick={onOpenStatus}
              className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
            >
              <img
                src={person.stories?.[0]?.mediaUrl || person.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.user || "User")}&background=27272a&color=ffffff`}
                alt={person.user}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/70 p-0.5 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{person.user}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {(person.stories || []).length > 1 ? `${person.stories.length} updates` : person.stories?.[0]?.time || "Recently"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-500 px-6 pt-1">
        Tip: swipe left / right anywhere here to switch tabs like WhatsApp.
      </p>
    </div>
  );

  const renderGroupsTabContent = () => (
    <div className="space-y-2 p-1">
      <button
        type="button"
        onClick={handleOpenGroupModal}
        className="w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm active:scale-[0.99] transition-transform"
      >
        <span className="w-10 h-10 rounded-2xl bg-white/15 dark:bg-black/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-xl">group_add</span>
        </span>
        <span className="text-left min-w-0">
          <span className="block text-xs font-bold">New group</span>
          <span className="block text-[11px] opacity-70 truncate">Create a group with your contacts</span>
        </span>
      </button>
      <div className="px-1 pt-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <span>Your groups</span>
        <span className="font-mono">{sortedRooms.length}</span>
      </div>
      {sortedRooms.length === 0 ? (
        <div className="p-8 text-center text-xs text-zinc-500">
          No groups yet. Tap New group above to create one.
        </div>
      ) : (
        sortedRooms.map(renderRoomCard)
      )}
    </div>
  );

  const renderCallsTabContent = () => {
    const formatCallTime = (d) => {
      try {
        const date = new Date(d);
        const now = new Date();
        if (date.toDateString() === now.toDateString()) {
          return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      } catch {
        return "";
      }
    };
    return (
      <div className="space-y-1.5 p-1">
        <div className="flex items-center justify-between px-1 pt-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-900 dark:text-white">Recent calls</span>
          <div className="flex items-center gap-2">
            {(callHistory || []).length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm("Clear your entire call history?")) return;
                  await clearCallHistory();
                }}
                className="text-[11px] text-zinc-500 hover:text-red-500 dark:text-zinc-400 transition-colors"
              >
                Clear
              </button>
            )}
            {onOpenCalls && (
              <button type="button" onClick={onOpenCalls} className="text-[11px] font-semibold text-accent-primary hover:underline">
                View all
              </button>
            )}
          </div>
        </div>
        {isCallHistoryLoading && (callHistory || []).length === 0 ? (
          <div className="flex items-center justify-center py-10 gap-2 text-zinc-500 text-xs">
            <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
            Loading calls…
          </div>
        ) : (callHistory || []).length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            No calls yet. Your recent calls will appear here.
          </div>
        ) : (
          (callHistory || []).slice(0, 30).map((log) => {
            const myId = authUser?._id?.toString();
            const outgoing = (log.callerId?._id || log.callerId)?.toString() === myId;
            const other = outgoing ? log.receiverId : log.callerId;
            const missed = log.status === "missed" || log.status === "rejected";
            return (
              <div
                key={log._id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/10 dark:border-white/10"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={other?.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(other?.username || "User")}&background=27272a&color=ffffff`}
                    alt={other?.username}
                    className="w-9 h-9 rounded-full object-cover border border-black/10 dark:border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${missed ? "text-red-500" : "text-zinc-900 dark:text-white"}`}>
                      {other?.username || "User"}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                      {missed ? "Missed" : outgoing ? "Outgoing" : "Incoming"} • {log.callType === "audio" ? "Voice" : "Video"} • {formatCallTime(log.startedAt)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const otherId = other?._id || other;
                    if (!otherId) return;
                    try { onOpenCalls?.(); } catch {}
                    startCall({
                      targetUser: {
                        _id: otherId,
                        id: otherId,
                        name: other?.username || "User",
                        username: other?.username || "User",
                        profilePic: other?.profilePic || "",
                        authName: authUser?.username,
                      },
                      callType: log.callType || "video",
                    });
                  }}
                  className="p-2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition-colors shrink-0"
                  title="Call back"
                >
                  <span className="material-symbols-outlined text-[18px]">{log.callType === "audio" ? "call" : "videocam"}</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    );
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
              <h1 className="font-bold tracking-tight text-zinc-900 dark:text-white text-xl leading-tight">
                {mobileTab === "updates" ? "Updates" : mobileTab === "groups" ? "Groups" : mobileTab === "calls" ? "Calls" : "Chats"}
              </h1>
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
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-theme-main hover:bg-[var(--glass-hover)] hover:text-accent-primary transition-colors text-left text-xs font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px] text-accent-primary">person</span>
                      <span>My Profile</span>
                    </button>
                  )}
                  {onOpenStarred && (
                    <button
                      onClick={() => { onOpenStarred(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-theme-main hover:bg-[var(--glass-hover)] hover:text-accent-primary transition-colors text-left text-xs font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px] text-accent-primary">star</span>
                      <span>Starred Messages</span>
                    </button>
                  )}
                  {onOpenAddFriend && (
                    <button
                      onClick={() => { onOpenAddFriend(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-theme-main hover:bg-[var(--glass-hover)] hover:text-accent-primary transition-colors text-left text-xs font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px] text-accent-primary">person_add</span>
                      <span>Contacts ({friends?.length || 0})</span>
                      {pendingCount > 0 && (
                        <span className="ml-auto px-1.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black font-mono text-[9px] font-bold">
                          {pendingCount}
                        </span>
                      )}
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
                  <button
                    onClick={() => { setShowLabelsManager(true); setShowOptionsDropdown(false); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-theme-main hover:bg-[var(--glass-hover)] hover:text-accent-primary transition-colors text-left text-xs font-medium"
                  >
                    <span className="material-symbols-outlined text-[16px] text-accent-primary">label</span>
                    <span>Chat Labels</span>
                  </button>
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

        {/* Search Bar with ⌘K — Chats tab only on mobile */}
        <div className={`relative items-center w-full mt-1 ${mobileTab === "chats" ? "flex" : "hidden"}`}>
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

        {/* Category Filter Tabs: All, Unread, Requests, Groups, Direct — Chats tab only on mobile */}
        <div className={`relative select-none ${mobileTab === "chats" ? "" : "hidden"}`}>
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
            onClick={() => setActiveFilter("channels")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === "channels"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5"
            }`}
            type="button"
          >
            <span>Channels</span>
            <span className="text-[10px] opacity-75 font-mono">({channelsCount})</span>
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

        {/* Label folders toolbar — hidden entirely when no labels exist
            so it never leaves a dead gap in the header */}
        {/* Label folders toolbar — chats tab only (desktop included) */}
        {(labels || []).length > 0 && mobileTab === "chats" && (
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
        )}
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

      {/* 2. Pending Friend Requests Banner List — Chats tab only on mobile */}
      {incomingRequests && incomingRequests.length > 0 && (
        <div className={`my-2 p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 dark:border-white/20 backdrop-blur-xl shadow-glass flex-col gap-2 shrink-0 animate-fadeIn ${mobileTab === "chats" ? "flex" : "hidden"}`}>
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

      {/* 4. Conversation List - desktop single pane, true swipeable pager on mobile */}
      {/* Mobile pager position dots (tap to jump) */}
      <div className="md:hidden flex items-center justify-center gap-1.5 pt-1 pb-0.5">
        {MOBILE_TABS.map((t, i) => (
          <button
            key={t}
            type="button"
            aria-label={`Go to ${t}`}
            onClick={() => {
              if (i !== mobileTabIndex) {
                setSearchQuery("");
                setMobileTab(t);
              }
            }}
            className={`h-1 rounded-full transition-all duration-300 ${
              mobileTab === t ? "w-5 bg-zinc-900 dark:bg-white" : "w-1 bg-zinc-300 dark:bg-zinc-700"
            }`}
          />
        ))}
      </div>
      <div
        ref={pagerViewportRef}
        onTouchStart={handlePagerTouchStart}
        onTouchMove={handlePagerTouchMove}
        onTouchEnd={handlePagerTouchEnd}
        onTouchCancel={handlePagerTouchEnd}
        className="flex-1 min-h-0 overflow-hidden touch-pan-y"
      >
        <div
          ref={pagerTrackRef}
          className="flex h-full"
          style={{
            transform: `translateX(${-mobileTabIndex * viewportW + (isPagerDragging ? gestureRef.current?.dx || 0 : 0)}px)`,
            transition: isPagerDragging ? "none" : "transform 280ms cubic-bezier(0.2, 0.8, 0.25, 1)",
          }}
        >
          {/* Page: Chats */}
          <div className="w-full shrink-0 h-full min-h-0 overflow-y-auto pr-0.5 custom-scrollbar space-y-1">
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

        {/* CHANNELS TAB: Followed broadcast channels + discovery */}
        {activeFilter === "channels" && (
          <>
            <button
              type="button"
              onClick={() => setShowChannelsModal(true)}
              className="w-full flex items-center justify-center gap-1.5 p-2.5 mb-1 rounded-2xl text-xs font-bold text-accent-primary bg-accent-primary/10 border border-accent-primary/25 hover:bg-accent-primary/20 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">travel_explore</span>
              Discover channels
            </button>
            {sortedChannels.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                No followed channels yet.
              </div>
            ) : (
              sortedChannels.map(renderRoomCard)
            )}
          </>
        )}
          </div>
          {/* Page: Updates */}
          <div className="w-full shrink-0 h-full min-h-0 overflow-y-auto pr-0.5 custom-scrollbar">
            {renderUpdatesTabContent()}
          </div>
          {/* Page: Groups */}
          <div className="w-full shrink-0 h-full min-h-0 overflow-y-auto pr-0.5 custom-scrollbar space-y-1">
            {renderGroupsTabContent()}
          </div>
          {/* Page: Calls */}
          <div className="w-full shrink-0 h-full min-h-0 overflow-y-auto pr-0.5 custom-scrollbar">
            {renderCallsTabContent()}
          </div>
        </div>
      </div>

      {isLocalCreateGroupOpen && <CreateGroupModal onClose={() => setIsLocalCreateGroupOpen(false)} />}
      {showLabelsManager && <LabelsManagerModal onClose={() => setShowLabelsManager(false)} />}
      {showChannelsModal && (
        <ChannelsModal onClose={() => setShowChannelsModal(false)} onOpenChannel={openChannelChat} />
      )}

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
                Notification tone
              </p>
              <div className="flex flex-wrap gap-1.5 px-2 pb-1">
                {CHAT_TONES.map((t) => {
                  const active =
                    (authUser?.chatPreferences?.[openMenuChat.id]?.tone || "chime") === t.id;
                  const saving = savingToneId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={!!savingToneId}
                      onClick={() => handleMenuTone(t.id)}
                      title={`Preview & set ${t.name}`}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all disabled:opacity-60 ${
                        active
                          ? "border-accent-primary bg-accent-primary/15 text-accent-primary"
                          : "border-[var(--glass-border)] text-theme-muted hover:text-theme-main"
                      }`}
                    >
                      {saving ? "Saving…" : t.name}
                    </button>
                  );
                })}
              </div>
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
              <button
                type="button"
                onClick={async () => {
                  await togglePinChat(openMenuChat.id);
                  closeChatMenu();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
              >
                <span className="material-symbols-outlined text-[16px] text-theme-muted">
                  {(authUser?.pinnedChats || []).includes(openMenuChat.id) ? "keep_off" : "push_pin"}
                </span>
                <span>{(authUser?.pinnedChats || []).includes(openMenuChat.id) ? "Unpin chat" : "Pin to top"}</span>
              </button>
              <button
                type="button"
                onClick={handleMenuLock}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
              >
                <span className="material-symbols-outlined text-[16px] text-theme-muted">
                  {isChatLockedAnywhere(openMenuChat.id, authUser?.chatPreferences, unlockedChats) ? "lock_open" : "lock"}
                </span>
                <span>{isChatLockedAnywhere(openMenuChat.id, authUser?.chatPreferences, unlockedChats) ? "Unlock chat" : "Lock chat"}</span>
              </button>
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
      {/* 5. Mobile bottom navigation (WhatsApp-style swipeable primary tabs).
          Rendered inside the sidebar column so it never overlaps content;
          hidden on desktop where the activity rail serves this role.
          Tapping switches the inline page — swiping the list above does the same. */}
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
            setSearchQuery("");
            setMobileTab("chats");
          }}
          className={`flex flex-col items-center gap-0.5 py-1 active:scale-95 transition-transform ${
            mobileTab === "chats" ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <span className={`relative flex items-center justify-center w-12 h-7 rounded-full transition-colors ${
            mobileTab === "chats" ? "bg-zinc-900/[0.07] dark:bg-white/10" : ""
          }`}>
            <span className="material-symbols-outlined text-[20px]">chat</span>
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black font-mono text-[9px] font-bold flex items-center justify-center shadow">
                {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
              </span>
            )}
          </span>
          <span className={`text-[10px] ${mobileTab === "chats" ? "font-semibold" : "font-medium"}`}>Chats</span>
        </button>

        <button
          type="button"
          onClick={() => { setSearchQuery(""); setMobileTab("updates"); }}
          className={`flex flex-col items-center gap-0.5 py-1 active:scale-95 transition-transform ${
            mobileTab === "updates" ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <span className={`relative flex items-center justify-center w-12 h-7 rounded-full transition-colors ${
            mobileTab === "updates" ? "bg-zinc-900/[0.07] dark:bg-white/10" : ""
          }`}>
            <span className="material-symbols-outlined text-[20px]">motion_photos_on</span>
            {unviewedStoryUsers.size > 0 && (
              <span className="absolute top-0.5 right-2.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-black" />
            )}
          </span>
          <span className={`text-[10px] ${mobileTab === "updates" ? "font-semibold" : "font-medium"}`}>Updates</span>
        </button>

        <button
          type="button"
          onClick={() => { setSearchQuery(""); setMobileTab("groups"); }}
          className={`flex flex-col items-center gap-0.5 py-1 active:scale-95 transition-transform ${
            mobileTab === "groups" ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <span className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${
            mobileTab === "groups" ? "bg-zinc-900/[0.07] dark:bg-white/10" : ""
          }`}>
            <span className="material-symbols-outlined text-[20px]">groups</span>
          </span>
          <span className={`text-[10px] ${mobileTab === "groups" ? "font-semibold" : "font-medium"}`}>Groups</span>
        </button>

        <button
          type="button"
          onClick={() => { setSearchQuery(""); setMobileTab("calls"); }}
          className={`flex flex-col items-center gap-0.5 py-1 active:scale-95 transition-transform ${
            mobileTab === "calls" ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <span className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${
            mobileTab === "calls" ? "bg-zinc-900/[0.07] dark:bg-white/10" : ""
          }`}>
            <span className="material-symbols-outlined text-[20px]">call_log</span>
          </span>
          <span className={`text-[10px] ${mobileTab === "calls" ? "font-semibold" : "font-medium"}`}>Calls</span>
        </button>
      </nav>
    </section>
  );
};

export default Sidebar;


