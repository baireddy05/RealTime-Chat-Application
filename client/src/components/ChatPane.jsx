import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo, memo, Fragment } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { useCallStore } from "../store/useCallStore";
import MessageInput from "./MessageInput";
import ImageModal from "./ImageModal";
import AudioMessagePlayer from "./AudioMessagePlayer";
import ForwardModal from "./ForwardModal";
import StarredDrawer from "./StarredDrawer";
import GroupInfoModal from "./GroupInfoModal";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { soundManager } from "../lib/sound";
import { notificationManager } from "../lib/notification";
import { 
  Loader, Search, X, CheckCheck, Pin, Trash2, Ban,
  Lock, MessageCircle, Volume2, VolumeX, Reply,
  Edit3, Forward, Star, Info, Plus,
  UploadCloud, Sparkles, ChevronUp, ChevronDown, DownloadCloud, Bell, BellOff,
  Clock, Flame, Palette, MessageSquare, MoreVertical
} from "lucide-react";
import FormattedMessageText from "./FormattedMessageText";
import LinkPreview from "./LinkPreview";
import ScheduledMessagesModal from "./ScheduledMessagesModal";
import ChatThemeModal from "./ChatThemeModal";
import { isOnlyEmojis, parseEmojiToHtml, EmojiSpan } from "../lib/emoji";
import { resolveThemeStyles, CHAT_DOODLE_SVG } from "../lib/chatThemes";
import ThreadDrawer from "./ThreadDrawer";
import MessageInfoModal from "./MessageInfoModal";
import ContactCard from "./ContactCard";
import SwipeableMessage from "./SwipeableMessage";
import MessageBubble from "./MessageBubble";
import { useBackHandler } from "../lib/backNavigation";
import { downloadFile } from "../lib/download";
import { isEncryptedMessage, getConversationKey, decryptMessage } from "../lib/crypto";

const getPinnedPreview = (msg, fallbackDecryptedText) => {
  if (!msg) return "";
  if (msg.isDeleted || msg.text === "This message was deleted" || msg.decryptedText === "This message was deleted") {
    return "🚫 This message was deleted";
  }
  if (msg.poll) return `📊 Poll: ${msg.poll.question || "Poll"}`;
  if (msg.audio) return "🎤 Voice Note";
  const isSticker = msg.isSticker || Boolean(msg.image && (msg.image.includes("/stickers/") || msg.image.includes("giphy-preview.gif") || msg.image.includes("sticker")));
  if (isSticker && (!msg.text || !msg.text.trim())) return "Sticker";
  if (msg.image) return msg.decryptedText || fallbackDecryptedText || (!isEncryptedMessage(msg.text) && msg.text ? msg.text : "📷 Photo");
  if (msg.file) return `📎 ${msg.file.name || "Attachment"}`;
  if (msg.contact) return `👤 Contact: ${msg.contact.fullName || msg.contact.username || "Contact"}`;
  
  const text = msg.decryptedText || fallbackDecryptedText || (isEncryptedMessage(msg.text) ? "🔒 Encrypted Message" : msg.text) || "";
  return text;
};

const isDifferentDay = (d1, d2) => {
  if (!d1 || !d2) return true;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return (
    date1.getFullYear() !== date2.getFullYear() ||
    date1.getMonth() !== date2.getMonth() ||
    date1.getDate() !== date2.getDate()
  );
};

const formatDateDivider = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
};

const formatFileSize = (bytes) => {
  if (!bytes) return "";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const SENDER_COLORS = [
  "text-[var(--sender-1)]", "text-[var(--sender-2)]", "text-[var(--sender-3)]",
  "text-[var(--sender-4)]", "text-[var(--sender-5)]", "text-[var(--sender-6)]",
];

const getSenderColor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
};

const extractFirstUrl = (text) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
};

const ChatHeader = memo(() => (
  <div className="pt-4 pb-2 px-4 flex flex-col items-center gap-2 select-none w-full">
    <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/[0.04] dark:bg-[var(--glass-heavy)] text-zinc-600 dark:text-zinc-400 text-[11px] max-w-md text-center border border-black/10 dark:border-[var(--glass-border)] shadow-sm">
      <span className="material-symbols-outlined text-zinc-500 dark:text-zinc-300 text-sm">lock</span>
      <span>Messages and calls are end-to-end encrypted.</span>
    </div>
  </div>
));

const ChatPane = ({ onBack }) => {
  const { theme } = useThemeStore();
  const {
    messages, getMessages, isMessagesLoading, selectedChat, setSelectedChat,
    subscribeToMessages, unsubscribeFromMessages, reactToMessage, deleteMessage,
    togglePinMessage, toggleStarMessage, setReplyingTo, setEditingMessage,
    forwardingMessage, setForwardingMessage, isStarredOpen, setIsStarredOpen,
    isGroupInfoOpen, setIsGroupInfoOpen, typingUsers, soundMuted, toggleSound,
    isChatThemeOpen, setIsChatThemeOpen, getEffectiveChatTheme,
    isScheduledOpen, setIsScheduledOpen,
    scheduledMessages, getScheduledMessages,
    openThread, closeThread, isThreadOpen,
    archivedChats, toggleArchiveChat,
  } = useChatStore();
  const { authUser, onlineUsers } = useAuthStore();
  const { startCall } = useCallStore();
  const [activeImage, setActiveImage] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [activePickerId, setActivePickerId] = useState(null);
  const [fullReactionPickerMsgId, setFullReactionPickerMsgId] = useState(null);
  const [openMenuMessageId, setOpenMenuMessageId] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [downloadingFileId, setDownloadingFileId] = useState(null);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [infoModalMessage, setInfoModalMessage] = useState(null);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(
    notificationManager.hasPermission()
  );
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [droppedFile, setDroppedFile] = useState(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const isSelectionMode = selectedMessageIds.length > 0;
  const dragCounterRef = useRef(0);

  // Mobile Back Navigation handlers for ChatPane overlays
  useBackHandler(!!activeImage, () => setActiveImage(null), "chat-modal-image");
  useBackHandler(!!messageToDelete, () => setMessageToDelete(null), "chat-modal-delete");
  useBackHandler(!!forwardingMessage, () => setForwardingMessage(null), "chat-modal-forward");
  useBackHandler(isGroupInfoOpen, () => setIsGroupInfoOpen(false), "chat-modal-group-info");
  useBackHandler(isScheduledOpen, () => setIsScheduledOpen(false), "chat-modal-scheduled");
  useBackHandler(isThreadOpen, () => closeThread(), "chat-drawer-thread");
  useBackHandler(!!infoModalMessage, () => setInfoModalMessage(null), "chat-modal-message-info");
  useBackHandler(isSearchOpen, () => setIsSearchOpen(false), "chat-search-bar");
  useBackHandler(showChatOptions, () => setShowChatOptions(false), "chat-dropdown-options");
  useBackHandler(!!openMenuMessageId, () => { setOpenMenuMessageId(null); setMenuAnchor(null); }, "chat-message-options");
  useBackHandler(!!fullReactionPickerMsgId, () => setFullReactionPickerMsgId(null), "chat-reaction-picker");

  useBackHandler(isSelectionMode, () => setSelectedMessageIds([]), "chat-selection-mode");

  // Close the header options dropdown on outside click / tap, anywhere on
  // screen. Document-level capture listener (not an overlay div): overlay
  // divs get clipped to their own pane by ancestor backdrop-filters, so taps
  // in the sidebar would never dismiss this menu.
  useEffect(() => {
    if (!showChatOptions) return;
    const handlePointerDown = (e) => {
      if (chatOptionsRef.current && !chatOptionsRef.current.contains(e.target)) {
        setShowChatOptions(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("touchstart", handlePointerDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("touchstart", handlePointerDown, true);
    };
  }, [showChatOptions]);

  const scrollerElementRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const chatOptionsRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [unreadBelowCount, setUnreadBelowCount] = useState(0);
  const loadedChatIdRef = useRef(null);
  const prevSelectedChatIdRef = useRef(selectedChat?.id);
  const messagesRef = useRef(messages);

  const onlineUsersSet = useMemo(() => new Set(onlineUsers || []), [onlineUsers]);
  const selectedUserId = (selectedChat?.id || selectedChat?._id)?.toString();
  const isUserOnline = selectedChat?.type === "user" && onlineUsersSet.has(selectedUserId);
  const activeTypers = useMemo(() => {
    if (!selectedChat?.id) return [];
    const list = typingUsers[selectedChat.id] || [];
    return list.filter((u) => u && u !== authUser?.username);
  }, [typingUsers, selectedChat?.id, authUser?.username]);

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return messages.filter((m) => {
      if (m.isDeleted) return false;
      const messageText = m.decryptedText || m.text || "";
      return messageText.toLowerCase().includes(q);
    });
  }, [messages, searchQuery]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const prevMessagesCountRef = useRef(messages.length);
  const isInitialChatLoadRef = useRef(true);

  const scrollToBottom = useCallback((behavior = "auto") => {
    const el = scrollerElementRef.current;
    if (el) {
      if (behavior === "instant" || behavior === "auto") {
        el.style.scrollBehavior = "auto";
        el.scrollTop = el.scrollHeight;
      } else {
        el.style.scrollBehavior = "smooth";
        el.scrollTo({
          top: el.scrollHeight,
          behavior: "smooth",
        });
      }
    }
    if (messagesEndRef.current && (behavior === "instant" || behavior === "auto")) {
      try {
        messagesEndRef.current.scrollIntoView({ block: "end", inline: "nearest" });
      } catch {}
    }
    // Maintain window at top on mobile
    if (typeof window !== "undefined" && window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
    isAtBottomRef.current = true;
    setShowScrollBottomBtn(false);
    setUnreadBelowCount(0);
  }, []);

  // Multi-frame scroll locking on initial load / chat switch
  const performInitialScrollToBottom = useCallback(() => {
    scrollToBottom("instant");
    const raf1 = requestAnimationFrame(() => {
      scrollToBottom("instant");
      const raf2 = requestAnimationFrame(() => {
        scrollToBottom("instant");
      });
      return () => cancelAnimationFrame(raf2);
    });
    const t1 = setTimeout(() => scrollToBottom("instant"), 50);
    const t2 = setTimeout(() => scrollToBottom("instant"), 150);
    const t3 = setTimeout(() => scrollToBottom("instant"), 350);
    const t4 = setTimeout(() => scrollToBottom("instant"), 600);

    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollerElementRef.current;
    if (!el) return;
    const threshold = 140;
    const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    isAtBottomRef.current = isBottom;
    setShowScrollBottomBtn(!isBottom);
    if (isBottom) {
      setUnreadBelowCount(0);
    }
  }, []);

  // Keep scroll pinned to bottom as images and layout elements render during initial load
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (isAtBottomRef.current || isInitialChatLoadRef.current) {
        const el = scrollerElementRef.current;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [selectedChat?.id]);

  // Snap instantly on chat load / switch, smooth scroll on new messages
  useLayoutEffect(() => {
    if (isMessagesLoading || !selectedChat?.id) return;

    if (isInitialChatLoadRef.current) {
      if (messages.length > 0 || !isMessagesLoading) {
        const cleanup = performInitialScrollToBottom();
        isInitialChatLoadRef.current = false;
        prevMessagesCountRef.current = messages.length;
        return cleanup;
      }
      return;
    }

    if (messages.length > prevMessagesCountRef.current) {
      const latestMsg = messages[messages.length - 1];
      const isMine = latestMsg?.senderId?._id === authUser?._id || latestMsg?.senderId === authUser?._id;

      if (isMine || isAtBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom("smooth"));
      } else {
        setUnreadBelowCount((c) => c + 1);
      }
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages, isMessagesLoading, selectedChat?.id, authUser?._id, scrollToBottom, performInitialScrollToBottom]);

  // Auto scroll when incoming typing bubble appears
  useEffect(() => {
    if (activeTypers.length > 0 && isAtBottomRef.current) {
      scrollToBottom("smooth");
    }
  }, [activeTypers.length, scrollToBottom]);

  // Global event listener for instant scroll on manual send / receive
  useEffect(() => {
    const handleScrollReq = () => {
      scrollToBottom("smooth");
    };
    window.addEventListener("pulse:scroll-to-bottom", handleScrollReq);
    return () => window.removeEventListener("pulse:scroll-to-bottom", handleScrollReq);
  }, [scrollToBottom]);

  useEffect(() => {
    if (!selectedChat) return;
    if (loadedChatIdRef.current !== selectedChat.id) {
      loadedChatIdRef.current = selectedChat.id;
      isInitialChatLoadRef.current = true;
      prevMessagesCountRef.current = 0;
      getMessages(selectedChat.id, selectedChat.type);
      getScheduledMessages(selectedChat.id, selectedChat.type);
    }
  }, [selectedChat, getMessages, getScheduledMessages]);

  useEffect(() => {
    if (prevSelectedChatIdRef.current !== selectedChat?.id) {
      prevSelectedChatIdRef.current = selectedChat?.id;
      isInitialChatLoadRef.current = true;
      prevMessagesCountRef.current = 0;
      setIsSearchOpen(false);
      setSearchQuery("");
      setSearchMatchIndex(0);
      setShowChatOptions(false);
      setOpenMenuMessageId(null);
      setMenuAnchor(null);
      setActivePickerId(null);
      setFullReactionPickerMsgId(null);
      setIsDraggingOver(false);
      setSelectedMessageIds([]);
      dragCounterRef.current = 0;
    }
  }, [selectedChat?.id]);

  const getMenuPositionStyle = useCallback(() => {
    if (!menuAnchor) return {};
    const menuWidth = 220;
    const menuHeight = 320;
    const padding = 12;
    const headerHeight = 65; // Chat header height
    const winWidth = typeof window !== "undefined" ? window.innerWidth : 400;
    const winHeight = typeof window !== "undefined" ? window.innerHeight : 700;

    // Horizontal alignment
    let left = menuAnchor.isMine ? (menuAnchor.right - menuWidth) : menuAnchor.left;
    left = Math.max(padding, Math.min(left, winWidth - menuWidth - padding));

    // Vertical alignment: check space above header vs space below
    const spaceBelow = winHeight - menuAnchor.bottom;
    const spaceAbove = menuAnchor.top - headerHeight;

    let top;
    // Prefer opening downwards if there is ample space below OR if space below is larger than space above
    if (spaceBelow >= menuHeight + 12 || spaceBelow >= spaceAbove) {
      top = menuAnchor.bottom + 6;
    } else {
      // Open upwards
      top = menuAnchor.top - menuHeight - 6;
    }

    // Final safety clamp: never go above the chat header and never overflow off bottom
    top = Math.max(headerHeight + 6, Math.min(top, winHeight - menuHeight - 12));

    return {
      position: "fixed",
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 99999,
      maxHeight: "calc(100vh - 90px)",
      overflowY: "auto",
    };
  }, [menuAnchor]);

  const handleStartCall = (type) => {
    if (!selectedChat) return;
    if (selectedChat.type === "room") {
      alert("1-on-1 audio and video calls are supported for direct contacts. Please select a user to call.");
      return;
    }
    const peerId = selectedChat.id || selectedChat._id;
    if (!peerId) {
      alert("Unable to find recipient user details.");
      return;
    }
    soundManager.initContext();
    startCall({
      targetUser: {
        _id: peerId,
        id: peerId,
        name: selectedChat.name || selectedChat.username,
        username: selectedChat.username || selectedChat.name,
        profilePic: selectedChat.avatar || selectedChat.profilePic || "",
        authName: authUser?.username,
      },
      callType: type,
    });
  };

  const displayedMessages = useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [messages]);

  const pinnedMessages = useMemo(() => messages.filter((m) => m.isPinned && !m.isDeleted), [messages]);
  const currentPinned = pinnedMessages.length > 0 ? pinnedMessages[pinnedIndex % pinnedMessages.length] : null;
  const [pinnedDecryptedText, setPinnedDecryptedText] = useState(null);

  useEffect(() => {
    let active = true;
    if (!currentPinned) {
      setPinnedDecryptedText(null);
      return;
    }
    if (currentPinned.decryptedText) {
      setPinnedDecryptedText(currentPinned.decryptedText);
      return;
    }
    if (currentPinned.text && isEncryptedMessage(currentPinned.text)) {
      const key = selectedChat ? getConversationKey(selectedChat, authUser?._id) : null;
      if (!key) {
        setPinnedDecryptedText("🔒 Encrypted Message");
        return;
      }
      decryptMessage(currentPinned.text, key)
        .then((dec) => {
          if (active) setPinnedDecryptedText(dec);
        })
        .catch(() => {
          if (active) setPinnedDecryptedText("🔒 Encrypted Message");
        });
    } else {
      setPinnedDecryptedText(currentPinned.text || "");
    }
    return () => {
      active = false;
    };
  }, [currentPinned, selectedChat, authUser?._id]);

  if (!selectedChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none relative bg-transparent overflow-hidden">
        <div className="absolute w-80 h-80 bg-accent-primary/[0.08] rounded-full blur-[100px] pointer-events-none -top-16 -right-16" />
        <div className="absolute w-64 h-64 bg-accent-secondary/[0.08] rounded-full blur-[100px] pointer-events-none -bottom-16 -left-16" />
        <div className="max-w-sm flex flex-col items-center relative z-10">
          <div className="w-20 h-20 rounded-3xl bg-[var(--glass-surface)] backdrop-blur-2xl border border-[var(--glass-border)] flex items-center justify-center mb-6 text-accent-primary shadow-glass">
            <MessageCircle size={40} />
          </div>
          <h2 className="text-2xl font-semibold text-theme-main mb-2 tracking-tight">Pulse Messenger</h2>
          <p className="text-[13px] text-theme-muted leading-relaxed mb-4">
            Select a conversation to start messaging.
          </p>
        </div>
      </div>
    );
  }

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const next = (searchMatchIndex + 1) % searchMatches.length;
    setSearchMatchIndex(next);
    scrollToMessage(searchMatches[next]._id);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prev = (searchMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setSearchMatchIndex(prev);
    scrollToMessage(searchMatches[prev]._id);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrevMatch();
      } else {
        handleNextMatch();
      }
    } else if (e.key === "Escape") {
      setIsSearchOpen(false);
      setSearchQuery("");
      setSearchMatchIndex(0);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDraggingOver(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounterRef.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setDroppedFile(file);
      soundManager.playAlertSound();
    }
  };

  const handleToggleNotifications = async () => {
    if (notificationManager.hasPermission()) {
      setHasNotificationPermission(true);
      notificationManager.sendNotification({
        title: "Pulse Notifications Active",
        body: "You will receive real-time desktop alerts when backgrounded.",
      });
    } else {
      const res = await notificationManager.requestPermission();
      const granted = res === "granted";
      setHasNotificationPermission(granted);
      if (granted) {
        soundManager.playAlertSound();
        notificationManager.sendNotification({
          title: "Pulse Notifications Enabled! 🎉",
          body: "You will now receive desktop notifications for new messages.",
        });
      }
    }
  };

  const handleExportChat = () => {
    if (!selectedChat || messages.length === 0) return;
    soundManager.playSendSound();

    const divider = "=".repeat(65);
    const subDivider = "-".repeat(65);
    const lines = [
      divider,
      "PULSE MESSENGER - CONVERSATION TRANSCRIPT",
      `Chat: ${selectedChat.name.replace(/^#/, "")} (${selectedChat.type === "room" ? "Channel / Group" : "Direct Message"})`,
      `Exported: ${new Date().toLocaleString()}`,
      `Total Messages: ${messages.length}`,
      divider,
      "",
    ];

    messages.forEach((msg) => {
      if (msg.isDeleted) return;
      const senderName = msg.senderId?.username || (msg.senderId === authUser._id ? authUser.username : "User");
      const time = new Date(msg.createdAt).toLocaleString();
      const editedTag = msg.isEdited ? " (edited)" : "";

      lines.push(`[${time}] ${senderName}${editedTag}:`);
      if (msg.decryptedText || msg.text) {
        const textContent = msg.decryptedText || (isEncryptedMessage(msg.text) ? "[Encrypted message]" : msg.text);
        lines.push(`  ${textContent}`);
      }
      if (msg.image) {
        lines.push(`  [Attachment: Image (${msg.image})]`);
      }
      if (msg.file) {
        lines.push(`  [Attachment: ${msg.file.name || "File"} (${formatFileSize(msg.file.size)})]`);
      }
      if (msg.audio) {
        lines.push(`  [Attachment: Voice Note (${msg.audioDuration ? Math.round(msg.audioDuration) + "s" : "Audio"})]`);
      }
      if (msg.reactions && msg.reactions.length > 0) {
        const reactionsSummary = msg.reactions.map((r) => `${r.emoji} (${r.username || "user"})`).join(", ");
        lines.push(`  Reactions: ${reactionsSummary}`);
      }
      lines.push("");
    });

    lines.push(subDivider);
    lines.push("End of conversation transcript - Pulse Messenger");
    lines.push(subDivider);

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const cleanName = selectedChat.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    a.href = url;
    a.download = `pulse-chat-${cleanName}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-accent-primary", "rounded-2xl", "shadow-glow");
      setTimeout(() => { el.classList.remove("ring-2", "ring-accent-primary", "shadow-glow"); }, 2000);
    }
  };

  const handleDelete = (messageId) => setMessageToDelete(messageId);



  const effectiveTheme = getEffectiveChatTheme(selectedChat?.id);
  const isDarkTheme = theme !== "light";
  const themeStyles = resolveThemeStyles(effectiveTheme, isDarkTheme);

  return (
    <div 
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        "--bubble-outgoing-gradient": themeStyles.bubbleOutgoingGradient,
        "--bubble-outgoing-text": themeStyles.bubbleOutgoingText,
        "--bubble-incoming-surface": themeStyles.bubbleIncomingSurface,
        "--bubble-incoming-text": themeStyles.bubbleIncomingText,
      }}
      className="h-full w-full flex flex-col overflow-hidden relative text-on-surface bg-transparent"
    >
      {/* 1. Dynamic Wallpaper Backdrop Layer (Custom Image or Gradient) */}
      {themeStyles.customWallpaperUrl ? (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none transition-all duration-500"
          style={{
            backgroundImage: `url(${themeStyles.customWallpaperUrl})`,
            opacity: themeStyles.wallpaperOpacity ?? 0.3,
          }}
        />
      ) : themeStyles.wallpaperGradient && themeStyles.wallpaperGradient !== "transparent" ? (
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-all duration-500"
          style={{
            background: themeStyles.wallpaperGradient,
            opacity: 0.85,
          }}
        />
      ) : null}

      {/* 2. Optional SVG Doodle Overlay */}
      {themeStyles.hasDoodles && (
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-20 dark:opacity-15 transition-opacity"
          style={{
            backgroundImage: `url("${CHAT_DOODLE_SVG}")`,
            backgroundSize: "280px 280px",
          }}
        />
      )}
      {/* Liquid Glass Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-accent-primary/10 backdrop-blur-xl border-2 border-dashed border-accent-primary rounded-3xl m-3 flex flex-col items-center justify-center animate-fadeIn pointer-events-none select-none">
          <div className="p-8 rounded-3xl bg-[var(--glass-heavy)] border border-[var(--glass-border)] shadow-glass flex flex-col items-center gap-4 animate-scaleIn text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-accent-primary/20 text-accent-primary flex items-center justify-center shadow-inner">
              <UploadCloud size={34} className="animate-bounce" />
            </div>
            <div>
              <p className="font-semibold text-lg text-theme-main flex items-center justify-center gap-2">
                <span>Drop files to send</span>
                <Sparkles size={16} className="text-accent-primary animate-pulse" />
              </p>
              <p className="text-[13px] text-theme-muted mt-1">
                Images, PDFs, documents & voice notes
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-accent-primary bg-accent-primary/10 px-3 py-1 rounded-full font-medium">
              <span>Supports files up to 50MB</span>
            </div>
          </div>
        </div>
      )}
      {/* Monochromatic Glass Chat Header */}
      {/* Monochromatic Glass Chat Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 xl:px-6 py-2.5 sm:py-3 bg-[var(--glass-header)] backdrop-blur-2xl border-b border-[var(--glass-border)] shadow-sm z-30 flex-shrink-0 relative">
        {isSearchOpen ? (
          <div className="flex items-center gap-2 w-full animate-fadeIn">
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
                setSearchMatchIndex(0);
              }}
              className="p-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
              title="Close search"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </button>
            <div className="flex-1 flex items-center bg-black/[0.04] dark:bg-[var(--glass-heavy)] border border-black/10 dark:border-[var(--glass-border)] rounded-xl px-3 py-1.5 gap-2 min-w-0">
              <span className="material-symbols-outlined text-zinc-500 dark:text-zinc-400 text-sm">search</span>
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchMatchIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                autoFocus
                className="bg-transparent text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none flex-1 min-w-0"
              />
              {searchQuery && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 px-1 font-mono select-none">
                    {searchMatches.length > 0 ? `${searchMatchIndex + 1}/${searchMatches.length}` : "0"}
                  </span>
                  {searchMatches.length > 0 && (
                    <div className="flex items-center">
                      <button
                        onClick={handlePrevMatch}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                        title="Previous match (Shift+Enter)"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        onClick={handleNextMatch}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                        title="Next match (Enter)"
                      >
                        <ChevronDown size={13} />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSearchMatchIndex(0);
                    }}
                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-0.5 rounded"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div 
              onClick={() => selectedChat.type === "room" && setIsGroupInfoOpen(true)}
              className={`flex items-center gap-2.5 sm:gap-3 min-w-0 ${selectedChat.type === "room" ? "cursor-pointer group select-none" : ""}`}
            >
              {onBack && (
                <button onClick={(e) => { e.stopPropagation(); onBack(); }}
                  className="md:hidden p-1.5 text-zinc-500 hover:text-zinc-900 rounded-xl hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 flex-shrink-0 transition-colors mr-0.5" title="Back to conversations">
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                </button>
              )}
              {selectedChat.type === "room" ? (
                <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] font-bold shrink-0 shadow-md">
                  <span className="material-symbols-outlined text-xl">groups</span>
                </div>
              ) : (
                <div className="relative shrink-0 w-9 h-9 sm:w-10 sm:h-10">
                  <img
                    src={selectedChat.profilePic || selectedChat.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.name)}&background=27272a&color=ffffff`}
                    alt={selectedChat.name}
                    className="w-full h-full rounded-full object-cover shadow-sm border border-black/10 dark:border-white/10"
                  />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full ring-2 ring-white dark:ring-[#121117] z-10 ${isUserOnline ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-zinc-400 dark:bg-zinc-600"}`} />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 truncate">
                  <h2 className="text-zinc-900 dark:text-white font-semibold truncate text-sm sm:text-base tracking-tight">
                    {selectedChat.name.replace(/^#/, "")}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[11px] sm:text-xs truncate">
                  <span className="text-zinc-400 dark:text-zinc-500 font-bold">•</span>
                  <span className="truncate">
                    {activeTypers.length > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1 animate-fadeIn">
                        {selectedChat.type === "room" ? (
                          <span className="truncate">{activeTypers.join(", ")} {activeTypers.length === 1 ? "is" : "are"} typing</span>
                        ) : (
                          <span>typing</span>
                        )}
                        <span className="inline-flex items-center gap-0.5 shrink-0 ml-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-typing-dot-1" />
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-typing-dot-2" />
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-typing-dot-3" />
                        </span>
                      </span>
                    ) : selectedChat.type === "room" ? (
                      `${selectedChat.members?.length || 1} participants • Group`
                    ) : isUserOnline ? (
                      "online"
                    ) : (
                      "offline"
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Monochromatic Header Action Dock */}
            <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
              <button
                onClick={() => handleStartCall("audio")}
                className="p-1.5 sm:p-2 rounded-xl bg-black/[0.03] text-zinc-700 hover:text-zinc-950 hover:bg-black/[0.08] border border-black/5 dark:bg-white/5 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/10 dark:border-white/5 transition-all"
                title="Start Voice Call"
                type="button"
              >
                <span className="material-symbols-outlined text-lg">call</span>
              </button>
              <button
                onClick={() => handleStartCall("video")}
                className="p-1.5 sm:p-2 rounded-xl bg-black/[0.03] text-zinc-700 hover:text-zinc-950 hover:bg-black/[0.08] border border-black/5 dark:bg-white/5 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/10 dark:border-white/5 transition-all"
                title="Start Video Call"
                type="button"
              >
                <span className="material-symbols-outlined text-lg">videocam</span>
              </button>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="hidden sm:flex p-2 rounded-xl bg-black/[0.03] text-zinc-700 hover:text-zinc-950 hover:bg-black/[0.08] border border-black/5 dark:bg-white/5 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/10 dark:border-white/5 transition-all"
                title="Search in thread"
                type="button"
              >
                <span className="material-symbols-outlined text-lg">search</span>
              </button>

          <div className="relative" ref={chatOptionsRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowChatOptions((p) => !p);
              }}
              className="p-1.5 sm:p-2 rounded-xl bg-black/[0.03] text-zinc-700 hover:text-zinc-950 hover:bg-black/[0.08] border border-black/5 dark:bg-white/5 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/10 dark:border-white/5 transition-all"
              title="Thread details"
              type="button"
            >
              <span className="material-symbols-outlined text-lg">more_vert</span>
            </button>
            {showChatOptions && (
                <div className="absolute right-0 top-10 z-50 bg-[rgb(var(--bg-surface-rgb))] border border-[var(--glass-border)] rounded-2xl shadow-glass py-1.5 w-56 animate-scaleIn smooth-gpu text-[13px]">
                  {selectedChat.type === "room" && (
                    <button
                      onClick={() => {
                        setIsGroupInfoOpen(true);
                        setShowChatOptions(false);
                      }}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center gap-2.5 text-theme-main hover:text-accent-primary transition-colors"
                    >
                      <Info size={14} className="text-accent-primary" /> Channel Info
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsStarredOpen(true);
                      setShowChatOptions(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center gap-2.5 text-theme-main hover:text-accent-primary transition-colors"
                  >
                    <Star size={14} className="text-accent-primary" /> Starred Messages
                  </button>
                  <button
                    onClick={() => {
                      setIsSearchOpen(true);
                      setShowChatOptions(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center gap-2.5 text-theme-main hover:text-accent-primary transition-colors"
                  >
                    <Search size={14} className="text-theme-muted" /> Find in Chat
                  </button>

                  <div className="h-px bg-[var(--glass-border)] my-1" />

                  {/* Sound FX Toggle */}
                  <button
                    onClick={() => {
                      toggleSound();
                      setShowChatOptions(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center justify-between text-theme-main transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {soundMuted ? (
                        <VolumeX size={14} className="text-red-400" />
                      ) : (
                        <Volume2 size={14} className="text-accent-primary" />
                      )}
                      <span>{soundMuted ? "Unmute Sound FX" : "Mute Sound FX"}</span>
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${soundMuted ? "bg-red-500/15 text-red-400" : "bg-accent-primary/15 text-accent-primary"}`}>
                      {soundMuted ? "Off" : "On"}
                    </span>
                  </button>

                  {/* Desktop Push Notifications */}
                  <button
                    onClick={() => {
                      handleToggleNotifications();
                      setShowChatOptions(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center justify-between text-theme-main transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {hasNotificationPermission ? (
                        <Bell size={14} className="text-accent-primary" />
                      ) : (
                        <BellOff size={14} className="text-theme-muted" />
                      )}
                      <span>Desktop Alerts</span>
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${hasNotificationPermission ? "bg-status-online/15 text-status-online" : "bg-[var(--glass-hover)] text-theme-muted"}`}>
                      {hasNotificationPermission ? "Enabled" : "Off"}
                    </span>
                  </button>

                  {/* Chat Theme Option */}
                  <button
                    onClick={() => {
                      setIsChatThemeOpen(true);
                      setShowChatOptions(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center gap-2.5 text-theme-main hover:text-accent-primary transition-colors cursor-pointer"
                  >
                    <Palette size={14} className="text-accent-primary" /> Chat Theme
                  </button>

                  <button
                    onClick={async () => {
                      const success = await toggleArchiveChat(selectedChat.id);
                      if (success) {
                        setShowChatOptions(false);
                        onBack();
                      }
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center gap-2.5 text-theme-main hover:text-accent-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-accent-primary leading-none">archive</span> 
                    {archivedChats.includes((selectedChat.id)?.toString()) ? "Unarchive Chat" : "Archive Chat"}
                  </button>

                  {/* Scheduled Messages Option */}
                  <button
                    onClick={() => {
                      setIsScheduledOpen(true);
                      setShowChatOptions(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center gap-2.5 text-theme-main hover:text-accent-primary transition-colors"
                  >
                    <Clock size={14} className="text-accent-primary" /> Scheduled Messages
                  </button>

                  {/* Chat History Export */}
                  <button
                    onClick={() => {
                      handleExportChat();
                      setShowChatOptions(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center gap-2.5 text-theme-main hover:text-accent-primary transition-colors"
                  >
                    <DownloadCloud size={14} className="text-accent-primary" />
                    <span>Export Transcript (.txt)</span>
                  </button>

                  {pinnedMessages.length > 0 && (
                    <>
                      <div className="h-px bg-[var(--glass-border)] my-1" />
                      <button
                        onClick={() => {
                          scrollToMessage(pinnedMessages[0]._id);
                          setShowChatOptions(false);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center gap-2.5 text-theme-main hover:text-accent-primary transition-colors"
                      >
                        <Pin size={14} className="text-accent-primary" /> Pinned ({pinnedMessages.length})
                      </button>
                    </>
                  )}
                </div>
            )}
          </div>
        </div>
        </>
      )}
      </div>

      {/* Bulk Action Header for Selection Mode */}
      {isSelectionMode && (
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 xl:px-6 py-3 bg-surface-container-highest backdrop-blur-xl border-b border-outline-variant/20 shadow-md animate-slideDown">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedMessageIds([])}
              className="p-1.5 rounded-full hover:bg-surface-container-high transition-colors"
              title="Cancel Selection"
            >
              <X size={20} className="text-on-surface" />
            </button>
            <span className="font-semibold text-on-surface">
              {selectedMessageIds.length} Selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Future bulk forward logic
                setSelectedMessageIds([]);
              }}
              className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface transition-colors flex items-center gap-2"
              title="Forward Selected"
            >
              <Forward size={18} />
              <span className="hidden sm:inline text-sm font-medium">Forward</span>
            </button>
            <button
              onClick={async () => {
                // Delete all selected messages directly
                const ids = [...selectedMessageIds];
                setSelectedMessageIds([]);
                for (const id of ids) {
                  try { await deleteMessage(id); } catch {}
                }
              }}
              className="p-2 rounded-lg hover:bg-error/20 text-error transition-colors flex items-center gap-2"
              title="Delete Selected"
            >
              <Trash2 size={18} />
              <span className="hidden sm:inline text-sm font-medium">Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Sticky Pinned Message Banner (Stitch Specification) */}
      {currentPinned && (
        <div className="flex items-center justify-between px-4 xl:px-6 py-2 bg-surface-container-high/70 backdrop-blur-md border-b border-outline-variant/15 shadow-sm z-20">
          <div className="flex items-center gap-space-md min-w-0 flex-1">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 shrink-0">
              <span className="material-symbols-outlined text-sm">push_pin</span>
            </div>
            <div className="flex items-center gap-space-sm min-w-0 flex-1 cursor-pointer" onClick={() => scrollToMessage(currentPinned._id)}>
              <span className="px-1.5 py-0.2 rounded bg-surface-container-highest text-amber-400 font-label-mono text-[10px] uppercase font-bold shrink-0">
                PINNED {pinnedMessages.length > 1 && `${pinnedIndex + 1}/${pinnedMessages.length}`}
              </span>
              <p className="font-body-md text-xs text-on-surface-variant truncate">
                {getPinnedPreview(currentPinned, pinnedDecryptedText)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-space-xs shrink-0">
            {pinnedMessages.length > 1 && (
              <>
                <button
                  onClick={() => setPinnedIndex((p) => (p - 1 + pinnedMessages.length) % pinnedMessages.length)}
                  className="p-1 rounded text-outline hover:text-on-surface"
                  title="Previous pinned message"
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </button>
                <button
                  onClick={() => setPinnedIndex((p) => (p + 1) % pinnedMessages.length)}
                  className="p-1 rounded text-outline hover:text-on-surface"
                  title="Next pinned message"
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </>
            )}
            <button
              onClick={() => togglePinMessage(currentPinned._id)}
              className="p-1 rounded text-outline hover:text-error transition-colors"
              title="Unpin from top"
              type="button"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative w-full">
        {isMessagesLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader className="size-6 animate-spin text-accent-primary" />
            <span className="text-[12px] text-theme-muted">Loading...</span>
          </div>
        ) : displayedMessages.length === 0 ? (
          <div className="text-center text-theme-muted mt-8 text-[13px]">
            {searchQuery ? `No messages matching "${searchQuery}"` : "No messages yet. Start the conversation!"}
          </div>
        ) : (
          <div
            ref={scrollerElementRef}
            onScroll={(e) => {
              handleScroll(e);
              if (openMenuMessageId) {
                setOpenMenuMessageId(null);
                setMenuAnchor(null);
              }
            }}
            className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain flex flex-col relative select-text"
            style={{ overflowAnchor: "auto" }}
          >
            <div ref={messagesContainerRef} className="mt-auto flex flex-col w-full">
              <ChatHeader />
              <div className="flex flex-col min-h-0 w-full pb-3">
              {(searchQuery.trim() ? searchMatches : displayedMessages).map((message, index, currentList) => (
                <MessageBubble
                  key={message._id}
                  message={message}
                  index={index}
                  currentList={currentList}
                  authUser={authUser}
                  selectedChat={selectedChat}
                  searchQuery={searchQuery}
                  isMenuOpen={openMenuMessageId === message._id}
                  setOpenMenuMessageId={setOpenMenuMessageId}
                  setMenuAnchor={setMenuAnchor}
                  setHoveredMessageId={setHoveredMessageId}
                  setActivePickerId={setActivePickerId}
                  setFullReactionPickerMsgId={setFullReactionPickerMsgId}
                  reactToMessage={reactToMessage}
                  setReplyingTo={setReplyingTo}
                  toggleStarMessage={toggleStarMessage}
                  setEditingMessage={setEditingMessage}
                  deleteMessage={handleDelete}
                  forwardMessage={setForwardingMessage}
                  togglePinMessage={togglePinMessage}
                  openMessageInfo={setInfoModalMessage}
                  setActiveImage={setActiveImage}
                  setDownloadingFileId={setDownloadingFileId}
                  downloadingFileId={downloadingFileId}
                  downloadFile={downloadFile}
                  scrollToMessage={scrollToMessage}
                  getMenuPositionStyle={getMenuPositionStyle}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedMessageIds.includes(message._id)}
                  toggleSelection={(id) => {
                    setSelectedMessageIds(prev => 
                      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
                    );
                  }}
                />
              ))}
              {/* Real-time Incoming Typing Indicator Speech Bubble */}
              {activeTypers.length > 0 && (
                <div className="flex items-end gap-2 px-4 sm:px-6 md:px-8 my-2 animate-messageIn select-none">
                  {selectedChat.type === "room" ? (
                    <div className="w-8 h-8 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm border border-black/10 dark:border-white/10 mb-0.5">
                      {(activeTypers[0] || "U").slice(0, 2).toUpperCase()}
                    </div>
                  ) : (
                    <img
                      src={
                        selectedChat.profilePic ||
                        selectedChat.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.name)}&background=27272a&color=ffffff`
                      }
                      alt={selectedChat.name}
                      className="w-8 h-8 rounded-full object-cover shadow-sm border border-black/10 dark:border-white/10 shrink-0 mb-0.5"
                    />
                  )}
                  <div className="flex flex-col items-start max-w-[80%]">
                    {selectedChat.type === "room" && (
                      <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 ml-1 mb-1 truncate">
                        {activeTypers.join(", ")}
                      </span>
                    )}
                    <div
                      className="px-4 py-3 rounded-2xl rounded-bl-[4px] shadow-sm flex items-center gap-1.5 backdrop-blur-xl border border-black/5 dark:border-white/10"
                      style={{
                        backgroundColor: themeStyles.bubbleIncomingSurface,
                        color: themeStyles.bubbleIncomingText,
                      }}
                    >
                      <span className="w-2 h-2 rounded-full bg-zinc-600 dark:bg-zinc-300 animate-typing-dot-1" />
                      <span className="w-2 h-2 rounded-full bg-zinc-600 dark:bg-zinc-300 animate-typing-dot-2" />
                      <span className="w-2 h-2 rounded-full bg-zinc-600 dark:bg-zinc-300 animate-typing-dot-3" />
                    </div>
                  </div>
                </div>
              )}
            </div>
              {/* Scroll bottom sentinel */}
              <div ref={messagesEndRef} className="h-2 w-full shrink-0" />
            </div>
          </div>
        )}

        {/* Floating Scroll-to-Bottom Button */}
        {showScrollBottomBtn && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="absolute right-4 sm:right-6 bottom-4 z-30 flex items-center justify-center w-10 h-10 rounded-full bg-white/95 dark:bg-[#1e1d26]/95 text-zinc-700 dark:text-zinc-200 shadow-2xl border border-black/10 dark:border-white/10 hover:scale-110 active:scale-95 transition-all backdrop-blur-xl animate-fadeIn cursor-pointer"
            title="Scroll to bottom"
          >
            <span className="material-symbols-outlined text-xl">arrow_downward</span>
            {unreadBelowCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black font-mono text-[9px] font-bold flex items-center justify-center shadow-md animate-pulse">
                {unreadBelowCount}
              </span>
            )}
          </button>
        )}
      </div>



      {/* Pending scheduled messages banner */}
      {scheduledMessages && scheduledMessages.length > 0 && (
        <div className="px-5 py-2 flex items-center justify-between text-[12px] text-accent-primary bg-[var(--glass-surface)] backdrop-blur-xl border-t border-[var(--glass-border)] animate-fadeIn">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-accent-primary animate-pulse flex-shrink-0" />
            <span className="font-medium">
              {scheduledMessages.length} scheduled {scheduledMessages.length === 1 ? "message" : "messages"} pending
            </span>
          </div>
          <button
            onClick={() => setIsScheduledOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-accent-primary/15 hover:bg-accent-primary/25 text-accent-primary text-[11px] font-semibold transition-all cursor-pointer"
          >
            View
          </button>
        </div>
      )}

      <MessageInput droppedFile={droppedFile} onClearDroppedFile={() => setDroppedFile(null)} />
      {activeImage && (
        <ImageModal
          imageUrl={activeImage}
          images={messages.filter(m => m.image && !m.isDeleted).map(m => m.image)}
          initialIndex={messages.filter(m => m.image && !m.isDeleted).findIndex(m => m.image === activeImage)}
          onClose={() => setActiveImage(null)}
        />
      )}

      {/* Delete confirmation */}
      {messageToDelete && (
        <div onClick={() => setMessageToDelete(null)} className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div onClick={(e) => e.stopPropagation()} className="bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl p-6 max-w-sm w-full shadow-glass space-y-4 animate-scaleIn text-theme-main">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-500 flex items-center justify-center flex-shrink-0"><Trash2 size={18} /></div>
              <div>
                <h3 className="font-semibold text-[15px] text-theme-main">Delete message?</h3>
                <p className="text-[12px] text-theme-muted mt-1 leading-relaxed">This will delete the message for everyone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button onClick={() => setMessageToDelete(null)} className="px-4 py-2 rounded-xl text-[12px] font-medium text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors">Cancel</button>
              <button onClick={async () => { const id = messageToDelete; setMessageToDelete(null); await deleteMessage(id); }}
                className="px-4 py-2 rounded-xl text-[12px] font-medium text-white bg-red-500 hover:bg-red-600 shadow-md transition-all active:scale-[0.97]">Delete</button>
            </div>
          </div>
        </div>
      )}

      {forwardingMessage && <ForwardModal message={forwardingMessage} onClose={() => setForwardingMessage(null)} />}
      {isStarredOpen && <StarredDrawer onClose={() => setIsStarredOpen(false)} />}
      {isGroupInfoOpen && selectedChat.type === "room" && (
        <GroupInfoModal group={selectedChat} onClose={() => setIsGroupInfoOpen(false)} onSelectUser={(userChat) => setSelectedChat(userChat)} />
      )}
      {isScheduledOpen && <ScheduledMessagesModal isOpen={isScheduledOpen} onClose={() => setIsScheduledOpen(false)} />}
      {isChatThemeOpen && <ChatThemeModal isOpen={isChatThemeOpen} onClose={() => setIsChatThemeOpen(false)} />}
      {isThreadOpen && <ThreadDrawer onClose={() => closeThread()} />}
      {infoModalMessage && <MessageInfoModal message={infoModalMessage} onClose={() => setInfoModalMessage(null)} />}

      {/* Full Reaction Emoji Picker Modal */}
      {fullReactionPickerMsgId && (
        <div
          onClick={() => setFullReactionPickerMsgId(null)}
          className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[340px] rounded-3xl shadow-2xl animate-scaleIn overflow-hidden border border-[var(--glass-border)] backdrop-blur-2xl bg-[var(--glass-heavy)] text-theme-main"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--glass-header)]">
              <span className="text-xs font-semibold text-theme-main">React with Any Emoji</span>
              <button
                type="button"
                onClick={() => setFullReactionPickerMsgId(null)}
                className="text-theme-muted hover:text-theme-main p-1 rounded-full hover:bg-[var(--glass-hover)] transition-colors"
              >
                <X size={15} />
              </button>
            </div>
            <div className="emoji-picker-container w-full overflow-hidden">
              <EmojiPicker
                theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
                onEmojiClick={(emojiData) => {
                  reactToMessage(fullReactionPickerMsgId, emojiData.emoji);
                  setFullReactionPickerMsgId(null);
                  setActivePickerId(null);
                }}
                autoFocusSearch={false}
                searchPlaceHolder="Search all emojis..."
                width="100%"
                height={320}
                lazyLoadEmojis={true}
                previewConfig={{ showPreview: false }}
                skinTonesDisabled={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPane;
