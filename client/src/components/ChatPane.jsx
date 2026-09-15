import { useEffect, useRef, useState, useCallback, useMemo, memo, Fragment } from "react";
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
import { resolveThemeStyles, WHATSAPP_DOODLE_SVG } from "../lib/chatThemes";
import ThreadDrawer from "./ThreadDrawer";
import MessageInfoModal from "./MessageInfoModal";
import { useBackHandler } from "../lib/backNavigation";

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
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [infoModalMessage, setInfoModalMessage] = useState(null);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(
    notificationManager.hasPermission()
  );
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [droppedFile, setDroppedFile] = useState(null);
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

  const scrollerElementRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [unreadBelowCount, setUnreadBelowCount] = useState(0);
  const loadedChatIdRef = useRef(null);
  const prevSelectedChatIdRef = useRef(selectedChat?.id);
  const messagesRef = useRef(messages);

  const onlineUsersSet = useMemo(() => new Set(onlineUsers || []), [onlineUsers]);

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

  const scrollToBottom = useCallback((behavior = "smooth") => {
    if (scrollerElementRef.current) {
      if (behavior === "instant" || behavior === "auto") {
        scrollerElementRef.current.scrollTop = scrollerElementRef.current.scrollHeight;
      } else {
        scrollerElementRef.current.scrollTo({
          top: scrollerElementRef.current.scrollHeight,
          behavior,
        });
      }
    }
    // Maintain window at top on mobile
    if (typeof window !== "undefined" && window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
    isAtBottomRef.current = true;
    setShowScrollBottomBtn(false);
    setUnreadBelowCount(0);
  }, []);

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

  // When new messages are sent or received
  useEffect(() => {
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
  }, [messages.length, authUser?._id, scrollToBottom]);

  // Ensure we snap to bottom when chat initially loads or switches
  useEffect(() => {
    if (!isMessagesLoading && messages.length > 0) {
      requestAnimationFrame(() => {
        scrollToBottom("instant");
      });
    }
  }, [selectedChat?.id, isMessagesLoading, scrollToBottom]);

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
      getMessages(selectedChat.id, selectedChat.type);
      getScheduledMessages(selectedChat.id, selectedChat.type);
    }
  }, [selectedChat, getMessages, getScheduledMessages]);

  useEffect(() => {
    if (prevSelectedChatIdRef.current !== selectedChat?.id) {
      prevSelectedChatIdRef.current = selectedChat?.id;
      setIsSearchOpen(false);
      setSearchQuery("");
      setSearchMatchIndex(0);
      setShowChatOptions(false);
      setOpenMenuMessageId(null);
      setActivePickerId(null);
      setIsDraggingOver(false);
      dragCounterRef.current = 0;
    }
  }, [selectedChat?.id]);

  useEffect(() => {
    const handleGlobalClick = () => {
      setOpenMenuMessageId(null);
      setActivePickerId(null);
      setFullReactionPickerMsgId(null);
    };
    if (openMenuMessageId || activePickerId || fullReactionPickerMsgId) {
      document.addEventListener("click", handleGlobalClick);
      return () => document.removeEventListener("click", handleGlobalClick);
    }
  }, [openMenuMessageId, activePickerId, fullReactionPickerMsgId]);

  const handleStartCall = (type) => {
    if (!selectedChat) return;
    if (selectedChat.type === "room") {
      alert("1-on-1 audio and video calls are supported for direct contacts. Please select a user to call.");
      return;
    }
    startCall({
      targetUser: {
        _id: selectedChat.id,
        name: selectedChat.name,
        username: selectedChat.name,
        authName: authUser?.username,
      },
      callType: type,
    });
  };

  const displayedMessages = useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [messages]);

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
      if (msg.text) {
        lines.push(`  ${msg.decryptedText || msg.text}`);
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

  const activeTypers = typingUsers[selectedChat.id] || [];
  const pinnedMessages = messages.filter((m) => m.isPinned && !m.isDeleted);
  const currentPinned = pinnedMessages.length > 0 ? pinnedMessages[pinnedIndex % pinnedMessages.length] : null;

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-accent-primary", "rounded-2xl", "shadow-glow");
      setTimeout(() => { el.classList.remove("ring-2", "ring-accent-primary", "shadow-glow"); }, 2000);
    }
  };

  const handleDelete = (messageId) => setMessageToDelete(messageId);
  const selectedUserId = (selectedChat?.id || selectedChat?._id)?.toString();
  const isUserOnline = selectedChat?.type === "user" && onlineUsersSet.has(selectedUserId);



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

      {/* 2. Optional WhatsApp SVG Doodle Overlay */}
      {themeStyles.hasDoodles && (
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-20 dark:opacity-15 transition-opacity"
          style={{
            backgroundImage: `url("${WHATSAPP_DOODLE_SVG}")`,
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
                  className="xl:hidden p-2 text-zinc-500 hover:text-zinc-900 rounded-xl hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 flex-shrink-0 transition-colors mr-0.5" title="Back to conversations">
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
                    {selectedChat.type === "room"
                      ? `${selectedChat.members?.length || 1} participants • Group`
                      : activeTypers.length > 0
                      ? "typing..."
                      : isUserOnline
                      ? "online"
                      : "offline"}
                  </span>
                </div>
              </div>
            </div>

            {/* Monochromatic Header Action Dock */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                onClick={() => handleStartCall("audio")}
                className="p-2 rounded-xl bg-black/[0.03] text-zinc-700 hover:text-zinc-950 hover:bg-black/[0.08] border border-black/5 dark:bg-white/5 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/10 dark:border-white/5 transition-all"
                title="Start Voice Call"
                type="button"
              >
                <span className="material-symbols-outlined text-lg">call</span>
              </button>
              <button
                onClick={() => handleStartCall("video")}
                className="p-2 rounded-xl bg-black/[0.03] text-zinc-700 hover:text-zinc-950 hover:bg-black/[0.08] border border-black/5 dark:bg-white/5 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/10 dark:border-white/5 transition-all"
                title="Start Video Call"
                type="button"
              >
                <span className="material-symbols-outlined text-lg">videocam</span>
              </button>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 rounded-xl bg-black/[0.03] text-zinc-700 hover:text-zinc-950 hover:bg-black/[0.08] border border-black/5 dark:bg-white/5 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/10 dark:border-white/5 transition-all"
                title="Search in thread"
                type="button"
              >
                <span className="material-symbols-outlined text-lg">search</span>
              </button>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowChatOptions((p) => !p);
              }}
              className="p-2 rounded-xl bg-black/[0.03] text-zinc-700 hover:text-zinc-950 hover:bg-black/[0.08] border border-black/5 dark:bg-white/5 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/10 dark:border-white/5 transition-all"
              title="Thread details"
              type="button"
            >
              <span className="material-symbols-outlined text-lg">more_vert</span>
            </button>
            {showChatOptions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowChatOptions(false)} />
                <div className="absolute right-0 top-10 z-50 bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl shadow-glass py-1.5 w-56 animate-scaleIn smooth-gpu text-[13px]">
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
              </>
            )}
          </div>
        </div>
        </>
      )}
      </div>

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
                {currentPinned.text || (currentPinned.image ? "📷 Photo" : "Attachment")}
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
            onScroll={handleScroll}
            className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain flex flex-col relative select-text"
            style={{ overflowAnchor: "auto" }}
          >
            <div className="mt-auto flex flex-col w-full">
              <ChatHeader />
              <div className="flex flex-col min-h-0 w-full pb-3">
              {(searchQuery.trim() ? searchMatches : displayedMessages).map((message, index, currentList) => {
                const isMine = message.senderId._id === authUser._id || message.senderId === authUser._id;
                const sender = message.senderId;
                const prevMessage = index > 0 ? currentList[index - 1] : null;
                const prevSenderId = prevMessage ? (prevMessage.senderId?._id || prevMessage.senderId) : null;
                const currentSenderId = message.senderId?._id || message.senderId;
                const isSameSenderAsPrev = prevSenderId === currentSenderId;

                const nextMessage = index < currentList.length - 1 ? currentList[index + 1] : null;
                const nextSenderId = nextMessage ? (nextMessage.senderId?._id || nextMessage.senderId) : null;
                const isSameSenderAsNext = nextSenderId === currentSenderId;

                const showDateDivider = !prevMessage || isDifferentDay(prevMessage.createdAt, message.createdAt);

                // Authentic speech bubble curvature & corner tail
                const bubbleRadius = isMine
                  ? `${isSameSenderAsPrev ? "rounded-tr-[8px]" : "rounded-tr-[20px]"} ${
                      isSameSenderAsNext ? "rounded-br-[8px]" : "rounded-br-[4px]"
                    } rounded-tl-[20px] rounded-bl-[20px]`
                  : `${isSameSenderAsPrev ? "rounded-tl-[8px]" : "rounded-tl-[20px]"} ${
                      isSameSenderAsNext ? "rounded-bl-[8px]" : "rounded-bl-[4px]"
                    } rounded-tr-[20px] rounded-br-[20px]`;

                const reactionGroups = (message.reactions || []).reduce((acc, r) => {
                  acc[r.emoji] = acc[r.emoji] || { emoji: r.emoji, count: 0, users: [], hasReacted: false };
                  acc[r.emoji].count += 1;
                  acc[r.emoji].users.push(r.username || "User");
                  if (r.userId === authUser._id || r.userId?._id === authUser._id) acc[r.emoji].hasReacted = true;
                  return acc;
                }, {});

                const readObj = (message.reads || []).find(r => r.userId === selectedChat.id);
                const isReadByRecipient = selectedChat.type === "user" && (readObj || (message.readBy || []).includes(selectedChat.id));
                const deliveryObj = (message.deliveries || []).find(d => d.userId === selectedChat.id);
                const isDeliveredToRecipient = selectedChat.type === "user" && !!deliveryObj;
                
                let statusTitle = `Sent: ${new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                if (isDeliveredToRecipient && deliveryObj?.at) {
                  statusTitle += `\nDelivered: ${new Date(deliveryObj.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                }
                if (isReadByRecipient && readObj?.at) {
                  statusTitle += `\nSeen: ${new Date(readObj.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                }
                const isStarred = (message.starredBy || []).some((id) => (id?._id || id) === authUser._id);
                const openUpwards = index >= 2;
                const isJustEmoji = !message.isDeleted && !message.image && !message.file && !message.audio && !message.replyTo && !message.isForwarded && !message.isPinned && isOnlyEmojis(message.decryptedText || message.text);

                return (
                  <Fragment key={message._id}>
                    {/* WhatsApp Dynamic Sticky Date Divider */}
                    {showDateDivider && (
                      <div className="my-2.5 flex items-center justify-center select-none sticky top-2 z-20 pointer-events-none">
                        <span className="px-3 py-0.5 rounded-full bg-black/40 dark:bg-black/60 backdrop-blur-md text-white text-[10px] font-medium tracking-wide shadow-md border border-white/10">
                          {formatDateDivider(message.createdAt)}
                        </span>
                      </div>
                    )}
                  <div
                    id={`msg-${message._id}`}
                    onMouseEnter={() => setHoveredMessageId(message._id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    className={`flex max-w-full relative group transition-all px-4 sm:px-6 md:px-8 ${
                      isSameSenderAsPrev ? "mt-1" : "mt-3.5"
                    } mb-0.5 ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    {!isMine && selectedChat.type === "room" && (
                      <div className="w-7 h-7 flex-shrink-0 self-end mb-0.5 mr-2">
                        {!isSameSenderAsNext ? (
                          <img
                            src={sender?.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(sender?.username || "User")}&background=2563eb&color=ffffff&size=64`}
                            alt={sender?.username}
                            className="w-7 h-7 rounded-full object-cover border border-[var(--glass-border)] shadow-sm"
                          />
                        ) : (
                          <div className="w-7 h-7" />
                        )}
                      </div>
                    )}

                    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[85%] md:max-w-[70%]`}>
                      <div className={`flex items-center gap-1.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                        {/* Speech Bubble */}
                        <div 
                          style={
                            !message.isDeleted
                              ? isJustEmoji
                                ? { background: 'transparent', color: isMine ? 'var(--bubble-outgoing-text)' : 'var(--bubble-incoming-text)', boxShadow: 'none', border: 'none' }
                                : isMine
                                  ? {
                                      background: 'var(--bubble-outgoing-gradient)',
                                      color: 'var(--bubble-outgoing-text)',
                                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35), inset 0 1px 1px 0 rgba(255, 255, 255, 0.4)',
                                    }
                                  : {
                                      background: 'var(--bubble-incoming-surface)',
                                      color: 'var(--bubble-incoming-text)',
                                      backdropFilter: 'blur(24px)',
                                      border: '1px solid var(--bubble-incoming-border)',
                                      boxShadow: 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.12)',
                                    }
                              : {}
                          }
                          className={`${isJustEmoji ? "py-1 px-1" : "py-2 px-3.5"} ${bubbleRadius} relative transition-all w-fit max-w-full ${
                            message.isDeleted
                              ? "bg-surface-container/40 text-outline italic"
                              : isMine && !isJustEmoji
                              ? "border border-black/10 dark:border-white/40 shadow-sm"
                              : ""
                          } ${
                            message.isOptimistic || (isMine && index === currentList.length - 1 && (Date.now() - new Date(message.createdAt).getTime() < 3500))
                              ? "animate-outgoing-glide"
                              : ""
                          }`}
                        >
                          {!isMine && selectedChat.type === "room" && !message.isDeleted && !isSameSenderAsPrev && (
                            <p className={`text-[11.5px] font-bold mb-1 tracking-tight ${getSenderColor(sender.username)}`}>{sender.username}</p>
                          )}
                          {message.isPinned && !message.isDeleted && (
                            <div className="flex items-center gap-1 text-[9px] font-medium mb-1 pb-1 border-b border-current/15 opacity-75">
                              <Pin size={9} /> Pinned
                            </div>
                          )}
                          {message.isForwarded && !message.isDeleted && (
                            <div className="flex items-center gap-1 text-[9px] italic mb-1 opacity-75">
                              <Forward size={10} /> Forwarded
                            </div>
                          )}
                          {message.replyTo && !message.isDeleted && (
                            <div onClick={() => message.replyTo.messageId && scrollToMessage(message.replyTo.messageId)}
                              className="mb-1.5 p-2 rounded-xl cursor-pointer transition-colors text-[11px] select-none bg-current/5 border-l-2 border-current/40">
                              <span className="font-semibold block text-[10px] opacity-90">{message.replyTo.senderName || "User"}</span>
                              <p className="truncate opacity-75">{message.replyTo.decryptedText || message.replyTo.text || (message.replyTo.image ? "📷 Photo" : "Attachment")}</p>
                            </div>
                          )}
                          {message.isDeleted ? (
                            <div className="flex items-center gap-2 text-[12px] py-0.5"><Ban size={12} /> This message was deleted</div>
                          ) : (
                            <>
                              {message.image && (
                                <div className="overflow-hidden rounded-xl mb-1.5">
                                  <img src={message.image} alt="Attachment" onClick={() => setActiveImage(message.image)}
                                    className="max-w-[280px] max-h-[280px] object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity" />
                                </div>
                              )}
                              {message.file && (
                                <div className="flex items-center justify-between p-2.5 rounded-xl transition-all border my-1 max-w-sm bg-current/5 border-current/10 hover:bg-current/10">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/20 text-red-500 dark:text-red-400 shrink-0">
                                      <span className="material-symbols-outlined text-xl">picture_as_pdf</span>
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-xs font-semibold truncate opacity-95">{message.file.name}</span>
                                      <span className="text-[11px] font-mono opacity-70">
                                        {formatFileSize(message.file.size)} • Document
                                      </span>
                                    </div>
                                  </div>
                                  <a
                                    href={message.file.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={message.file.name}
                                    className="p-2 rounded-lg transition-all ml-2 shrink-0 bg-current/10 hover:bg-current/20 text-current"
                                    title="Download Document"
                                  >
                                    <span className="material-symbols-outlined text-base">download</span>
                                  </a>
                                </div>
                              )}
                              {message.audio && <div className="mb-0.5"><AudioMessagePlayer audioUrl={message.audio} isMine={isMine} /></div>}
                              {message.expiresAt && (
                                <div className="mb-1.5 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-sm animate-pulse">
                                  <Flame size={10} />
                                  <span>Disappearing Message</span>
                                </div>
                              )}
                              {message.text && (
                                <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1">
                                  <div className={`${isJustEmoji ? "text-[42px] leading-tight emoji-text drop-shadow-md" : "text-[15.5px] leading-relaxed break-words font-normal"}`}>
                                    <FormattedMessageText text={message.decryptedText || message.text} isMine={isMine} searchQuery={searchQuery} />
                                  </div>
                                  <div className="inline-flex items-center gap-1 text-[10px] select-none ml-auto self-end flex-shrink-0 -mb-0.5 pb-0.5 opacity-70">
                                    {message.isEdited && <span className="italic text-[9px] opacity-75">(edited)</span>}
                                    <span className={isJustEmoji ? "text-theme-muted drop-shadow-sm font-semibold" : ""}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                    {isMine && !message.isDeleted && (
                                      message.isOptimistic ? (
                                        <Clock size={11} className={`opacity-70 animate-pulse ${isJustEmoji ? "text-theme-muted drop-shadow-sm" : ""}`} title="Sending..." />
                                      ) : (
                                        <span 
                                          title={statusTitle}
                                          className={`material-symbols-outlined text-sm cursor-help ${isJustEmoji ? "text-theme-muted drop-shadow-sm " : ""}${isReadByRecipient ? "font-bold opacity-100 text-blue-500" : "font-semibold opacity-70"}`}
                                        >
                                          {isReadByRecipient || isDeliveredToRecipient ? "done_all" : "done"}
                                        </span>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {(() => {
                                const url = extractFirstUrl(message.decryptedText || message.text);
                                return url ? <LinkPreview url={url} /> : null;
                              })()}

                              {!message.text && (
                                <div className="flex items-center justify-end gap-1 mt-1 select-none opacity-70">
                                  {message.isEdited && <span className="text-[9px] italic opacity-75">(edited)</span>}
                                  <span className="text-[10px] font-medium">
                                    {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                  {isMine && !message.isDeleted && (
                                    message.isOptimistic ? (
                                      <Clock size={11} className="opacity-70 animate-pulse" title="Sending..." />
                                    ) : (
                                      <span 
                                        title={statusTitle}
                                        className={`material-symbols-outlined text-sm cursor-help ${isReadByRecipient ? "font-bold opacity-100 text-blue-500" : "font-semibold"}`}
                                      >
                                        {isReadByRecipient || isDeliveredToRecipient ? "done_all" : "done"}
                                      </span>
                                    )
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* 3-dot dropdown menu trigger & popover */}
                        {!message.isDeleted && (
                          <div className="relative flex items-center flex-shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuMessageId(openMenuMessageId === message._id ? null : message._id);
                                setActivePickerId(null);
                              }}
                              className={`p-1.5 rounded-full bg-[var(--glass-heavy)] border border-[var(--glass-border)] shadow-sm transition-all duration-150 cursor-pointer ${
                                openMenuMessageId === message._id || hoveredMessageId === message._id
                                  ? "opacity-100 scale-100 pointer-events-auto text-theme-main bg-[var(--glass-hover)]"
                                  : "opacity-0 scale-75 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)]"
                              }`}
                              title="Message options"
                            >
                              <MoreVertical size={13} />
                            </button>

                            {openMenuMessageId === message._id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute ${openUpwards ? "bottom-full mb-1.5" : "top-full mt-1.5"} ${
                                  isMine ? "right-0" : "left-0"
                                } z-50 min-w-[210px] p-1.5 rounded-2xl bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-2xl animate-scaleIn select-none`}
                              >
                                {/* Quick Reactions row */}
                                <div className="flex items-center justify-between gap-1 px-1.5 py-1 mb-1 bg-white/5 rounded-xl border border-white/5">
                                  {QUICK_REACTIONS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => {
                                        reactToMessage(message._id, emoji);
                                        setOpenMenuMessageId(null);
                                      }}
                                      className="hover:scale-125 transition-transform p-1 rounded-lg hover:bg-white/10 quick-reaction-btn flex items-center justify-center"
                                      title={`React ${emoji}`}
                                    >
                                      <EmojiSpan text={emoji} />
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFullReactionPickerMsgId(fullReactionPickerMsgId === message._id ? null : message._id);
                                      setOpenMenuMessageId(null);
                                    }}
                                    className="p-1 rounded-lg text-theme-muted hover:text-theme-main hover:bg-white/10 transition-all flex items-center justify-center"
                                    title="More reactions"
                                  >
                                    <Plus size={13} />
                                  </button>
                                </div>

                                <div className="h-px bg-[var(--glass-border)] my-1" />

                                {/* Menu Options */}
                                <div className="flex flex-col gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyingTo(message);
                                      setOpenMenuMessageId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                                  >
                                    <Reply size={14} className="text-theme-muted" />
                                    <span>Reply</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      toggleStarMessage(message._id);
                                      setOpenMenuMessageId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                                  >
                                    <Star size={14} className={isStarred ? "text-amber-400 fill-amber-400" : "text-theme-muted"} />
                                    <span>{isStarred ? "Unstar Message" : "Star Message"}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setForwardingMessage(message);
                                      setOpenMenuMessageId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                                  >
                                    <Forward size={14} className="text-theme-muted" />
                                    <span>Forward</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      togglePinMessage(message._id);
                                      setOpenMenuMessageId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                                  >
                                    <Pin size={14} className={message.isPinned ? "text-accent-primary fill-accent-primary" : "text-theme-muted"} />
                                    <span>{message.isPinned ? "Unpin Message" : "Pin Message"}</span>
                                  </button>

                                  {isMine && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingMessage(message);
                                        setOpenMenuMessageId(null);
                                      }}
                                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                                    >
                                      <Edit3 size={14} className="text-theme-muted" />
                                      <span>Edit Message</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInfoModalMessage(message);
                                      setOpenMenuMessageId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                                  >
                                    <Info size={14} className="text-theme-muted" />
                                    <span>Message Info</span>
                                  </button>

                                  {isMine && (
                                    <>
                                      <div className="h-px bg-[var(--glass-border)] my-1" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleDelete(message._id);
                                          setOpenMenuMessageId(null);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors text-left"
                                      >
                                        <Trash2 size={14} className="text-red-400" />
                                        <span>Delete Message</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                            {fullReactionPickerMsgId === message._id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute bottom-full mb-2 ${isMine ? "right-0" : "left-0"} z-50 rounded-3xl shadow-glass animate-scaleIn overflow-hidden border border-[var(--glass-border)] backdrop-blur-2xl bg-[var(--glass-heavy)] max-w-[calc(100vw-24px)]`}
                                style={{ width: "320px" }}
                              >
                                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--glass-border)] bg-[var(--glass-header)]">
                                  <span className="text-xs font-semibold text-theme-main">React with Any Emoji</span>
                                  <button
                                    type="button"
                                    onClick={() => setFullReactionPickerMsgId(null)}
                                    className="text-theme-muted hover:text-theme-main p-1 rounded-full hover:bg-[var(--glass-hover)] transition-colors"
                                  >
                                    <X size={13} />
                                  </button>
                                </div>
                                <div className="emoji-picker-container">
                                  <EmojiPicker
                                    theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
                                    onEmojiClick={(emojiData) => {
                                      reactToMessage(message._id, emojiData.emoji);
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
                            )}
                          </div>
                        )}
                      </div>

                      {/* Reactions */}
                      {!message.isDeleted && Object.keys(reactionGroups).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.values(reactionGroups).map((grp) => (
                            <button key={grp.emoji} onClick={() => reactToMessage(message._id, grp.emoji)} title={`Reacted by: ${grp.users.join(", ")}`}
                              className={`flex items-center gap-1.5 text-[14px] px-2.5 py-1 rounded-full border transition-all shadow-sm reaction-pill ${
                                grp.hasReacted ? "bg-accent-primary/20 border-accent-primary/40 text-accent-primary font-medium" : "bg-[var(--glass-surface)] border-[var(--glass-border)] text-theme-muted hover:bg-[var(--glass-hover)] hover:text-theme-main"
                              }`}>
                              <EmojiSpan text={grp.emoji} /><span className="text-[11px] font-semibold opacity-80">{grp.count}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Thread Replies Button */}
                      {!message.isDeleted && message.threadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => openThread(message)}
                          className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-xl bg-accent-primary/10 border border-accent-primary/25 text-accent-primary hover:bg-accent-primary/20 transition-all group select-none shadow-sm cursor-pointer"
                        >
                          <MessageSquare size={12} className="group-hover:scale-110 transition-transform" />
                          <span>
                            {message.threadCount} {message.threadCount === 1 ? "reply" : "replies"}
                          </span>
                          {message.threadLastReply && (
                            <span className="text-[10px] opacity-70">
                              • {new Date(message.threadLastReply).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  </Fragment>
                );
              })}
            </div>
              {/* Scroll bottom sentinel */}
              <div ref={messagesEndRef} className="h-2 w-full shrink-0" />
            </div>
          </div>
        )}

        {/* WhatsApp Floating Scroll-to-Bottom Button */}
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
      {activeImage && <ImageModal imageUrl={activeImage} onClose={() => setActiveImage(null)} />}

      {/* Delete confirmation */}
      {messageToDelete && (
        <div onClick={() => setMessageToDelete(null)} className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
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
      {isStarredOpen && <StarredDrawer onClose={() => setIsStarredOpen(false)} onJumpToMessage={(msgId) => scrollToMessage(msgId)} />}
      {isGroupInfoOpen && selectedChat.type === "room" && (
        <GroupInfoModal group={selectedChat} onClose={() => setIsGroupInfoOpen(false)} onSelectUser={(userChat) => setSelectedChat(userChat)} />
      )}
      {isScheduledOpen && <ScheduledMessagesModal isOpen={isScheduledOpen} onClose={() => setIsScheduledOpen(false)} />}
      {isChatThemeOpen && <ChatThemeModal isOpen={isChatThemeOpen} onClose={() => setIsChatThemeOpen(false)} />}
      {isThreadOpen && <ThreadDrawer onClose={() => closeThread()} />}
      {infoModalMessage && <MessageInfoModal message={infoModalMessage} onClose={() => setInfoModalMessage(null)} />}
    </div>
  );
};

export default ChatPane;
