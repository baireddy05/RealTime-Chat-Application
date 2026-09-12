import { useEffect, useRef, useState, Fragment } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
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
  Loader, Search, X, CheckCheck, SmilePlus, Pin, PinOff, Trash2, Ban,
  ChevronRight, Phone, Video, MoreVertical, Lock, MessageCircle,
  Mic, MicOff, VideoOff, PhoneOff, Volume2, VolumeX, ArrowLeft, Reply,
  Edit3, Forward, Star, FileText, Download, Info, Plus,
  UploadCloud, Sparkles, ChevronUp, ChevronDown, DownloadCloud, Bell, BellOff,
  Clock, Flame, Palette, Bot, MessageSquare
} from "lucide-react";
import FormattedMessageText from "./FormattedMessageText";
import LinkPreviewCard from "./LinkPreviewCard";
import ScheduledMessagesModal from "./ScheduledMessagesModal";
import WallpaperModal, { WALLPAPER_PRESETS } from "./WallpaperModal";
import ThreadDrawer from "./ThreadDrawer";

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

const highlightMatches = (text, query, isMine) => {
  if (!query || !query.trim() || !text) return text;
  const trimmed = query.trim();
  const escapedQuery = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, index) =>
    part.toLowerCase() === trimmed.toLowerCase() ? (
      <mark key={index} className={isMine ? "bg-amber-300 text-slate-950 font-bold px-0.5 rounded" : "bg-amber-200 text-amber-950 font-bold px-0.5 rounded"}>
        {part}
      </mark>
    ) : part
  );
};

const ChatPane = ({ onBack }) => {
  const { theme } = useThemeStore();
  const {
    messages, getMessages, isMessagesLoading, selectedChat, setSelectedChat,
    subscribeToMessages, unsubscribeFromMessages, reactToMessage, deleteMessage,
    togglePinMessage, toggleStarMessage, setReplyingTo, setEditingMessage,
    forwardingMessage, setForwardingMessage, isStarredOpen, setIsStarredOpen,
    isGroupInfoOpen, setIsGroupInfoOpen, typingUsers, soundMuted, toggleSound,
    chatWallpapers, globalWallpaper, isWallpaperOpen, setIsWallpaperOpen,
    isScheduledOpen, setIsScheduledOpen,
    openThread, closeThread, isThreadOpen, activeThreadMessage,
  } = useChatStore();
  const { authUser, onlineUsers } = useAuthStore();
  const [activeImage, setActiveImage] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [activePickerId, setActivePickerId] = useState(null);
  const [fullReactionPickerMsgId, setFullReactionPickerMsgId] = useState(null);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const [activeCall, setActiveCall] = useState(null);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [isChatMuted, setIsChatMuted] = useState(false);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(
    notificationManager.hasPermission()
  );
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [droppedFile, setDroppedFile] = useState(null);
  const dragCounterRef = useRef(0);

  const messagesContainerRef = useRef(null);
  const loadedChatIdRef = useRef(null);
  const prevSelectedChatIdRef = useRef(selectedChat?.id);
  const messagesRef = useRef(messages);
  const unreadSeparatorId = null;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!selectedChat) return;
    if (loadedChatIdRef.current !== selectedChat.id) {
      loadedChatIdRef.current = selectedChat.id;
      getMessages(selectedChat.id, selectedChat.type);
    }
    subscribeToMessages();
    return () => {
      unsubscribeFromMessages();
    };
  }, [selectedChat, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if (prevSelectedChatIdRef.current !== selectedChat?.id) {
      prevSelectedChatIdRef.current = selectedChat?.id;
      setIsSearchOpen(false);
      setSearchQuery("");
      setSearchMatchIndex(0);
      setShowChatOptions(false);
      setIsDraggingOver(false);
      dragCounterRef.current = 0;
    }
  }, [selectedChat?.id]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleContainerScroll = () => {};

  const startCall = (type) => {
    setActiveCall({ type, status: "Connected", startTime: Date.now() });
    setCallDuration(0);
  };

  const endCall = () => {
    setActiveCall(null);
  };

  useEffect(() => {
    let interval = null;
    if (activeCall && activeCall.status === "Connected") {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeCall]);

  const formatCallTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

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
          <p className="text-[13px] text-theme-muted leading-relaxed mb-8">
            Select a conversation to start messaging with end-to-end encryption.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-theme-muted bg-[var(--glass-surface)] border border-[var(--glass-border)] px-4 py-2 rounded-xl shadow-glass">
            <Lock size={12} className="text-accent-primary" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
      </div>
    );
  }

  const displayedMessages = messages;
  const searchMatches = searchQuery.trim()
    ? messages.filter((m) => !m.isDeleted && m.text && m.text.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : [];

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
        lines.push(`  ${msg.text}`);
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
    if (el && messagesContainerRef.current) {
      const containerRect = messagesContainerRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      messagesContainerRef.current.scrollTo({ top: elRect.top - containerRect.top + messagesContainerRef.current.scrollTop - 40, behavior: "smooth" });
      el.classList.add("ring-2", "ring-accent-primary", "rounded-2xl", "shadow-glow");
      setTimeout(() => { el.classList.remove("ring-2", "ring-accent-primary", "shadow-glow"); }, 2000);
    }
  };

  const handleDelete = (messageId) => setMessageToDelete(messageId);
  const isUserOnline = selectedChat.type === "user" && onlineUsers.includes(selectedChat.id);

  const actionBtnClass = (visible) =>
    `p-1.5 rounded-full bg-[var(--glass-heavy)] border border-[var(--glass-border)] text-theme-muted hover:text-theme-main shadow-sm transition-all duration-150 cursor-pointer ${
      visible ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-75 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto"
    }`;

  const currentChatWallpaper =
    (selectedChat?.id && chatWallpapers[selectedChat.id]) || globalWallpaper || "default";
  const wallpaperPreset = WALLPAPER_PRESETS.find((p) => p.id === currentChatWallpaper);
  const wallpaperStyle = currentChatWallpaper.startsWith("http")
    ? {
        backgroundImage: `url(${currentChatWallpaper})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: 0.25,
      }
    : wallpaperPreset && wallpaperPreset.id !== "default"
    ? {
        background: wallpaperPreset.previewGradient,
        opacity: 0.18,
      }
    : null;

  return (
    <div 
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 flex flex-col overflow-hidden relative bg-transparent"
    >
      {/* Dynamic Wallpaper Backdrop Layer */}
      {wallpaperStyle && (
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-all duration-700"
          style={wallpaperStyle}
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
      {/* Header */}
      <div className="h-[60px] border-b border-[var(--glass-border)] flex items-center justify-between px-3 md:px-5 z-30 flex-shrink-0 relative bg-[var(--glass-surface)] backdrop-blur-xl">
        <div 
          onClick={() => selectedChat.type === "room" && setIsGroupInfoOpen(true)}
          className={`flex items-center gap-2 md:gap-3 min-w-0 ${selectedChat.type === "room" ? "cursor-pointer group select-none" : ""}`}
        >
          {onBack && (
            <button onClick={(e) => { e.stopPropagation(); onBack(); }}
              className="md:hidden p-2 text-theme-muted hover:text-theme-main rounded-lg hover:bg-[var(--glass-hover)] flex-shrink-0 transition-colors">
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="relative flex-shrink-0">
            <img
              src={selectedChat.type === "room"
                ? `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.name.replace(/^#/, ""))}&background=2563eb&color=ffffff`
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.name)}&background=2563eb&color=ffffff`}
              alt={selectedChat.name}
              className="w-9 h-9 rounded-full object-cover border border-[var(--glass-border)] group-hover:border-accent-primary transition-all"
            />
            {isUserOnline && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-status-online ring-2 ring-[var(--glass-surface)]" />}
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-[14px] text-theme-main truncate leading-tight capitalize flex items-center gap-1.5">
              <span>{selectedChat.name.replace(/^#/, "")}</span>
              {selectedChat.type === "room" && <Info size={12} className="text-theme-muted group-hover:text-accent-primary transition-colors" />}
            </h3>
            <p className="text-[11px] truncate">
              {selectedChat.type === "room" ? (
                <span className="text-theme-muted">{selectedChat.members?.length ? `${selectedChat.members.length} members` : "Channel"}</span>
              ) : activeTypers.length > 0 ? (
                <span className="text-accent-primary font-medium">typing...</span>
              ) : isUserOnline ? (
                <span className="text-status-online font-medium">Online</span>
              ) : (
                <span className="text-theme-muted/60">Offline</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button onClick={() => startCall("video")} className="p-2 text-theme-muted hover:text-theme-main rounded-lg hover:bg-[var(--glass-hover)] transition-colors" title="Video call"><Video size={17} /></button>
          <button onClick={() => startCall("audio")} className="p-2 text-theme-muted hover:text-theme-main rounded-lg hover:bg-[var(--glass-hover)] transition-colors" title="Voice call"><Phone size={16} /></button>

          {isSearchOpen ? (
            <div className="flex items-center glass-input border border-[var(--glass-border)] rounded-xl px-2.5 py-1 gap-1.5 animate-fadeIn">
              <Search size={13} className="text-theme-muted flex-shrink-0" />
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
                className="bg-transparent text-[12px] text-theme-main placeholder-theme-muted/50 focus:outline-none w-24 sm:w-36"
              />
              {searchQuery && (
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-theme-muted px-1 font-medium select-none">
                    {searchMatches.length > 0
                      ? `${searchMatchIndex + 1}/${searchMatches.length}`
                      : "0"}
                  </span>
                  {searchMatches.length > 0 && (
                    <div className="flex items-center">
                      <button
                        onClick={handlePrevMatch}
                        className="p-1 rounded-md text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
                        title="Previous match (Shift+Enter)"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        onClick={handleNextMatch}
                        className="p-1 rounded-md text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
                        title="Next match (Enter)"
                      >
                        <ChevronDown size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                  setSearchMatchIndex(0);
                }}
                className="text-theme-muted hover:text-theme-main p-0.5 rounded transition-colors"
                title="Close search (Esc)"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-theme-muted hover:text-theme-main rounded-lg hover:bg-[var(--glass-hover)] transition-colors"
              title="Search messages"
            >
              <Search size={17} />
            </button>
          )}

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowChatOptions((p) => !p);
              }}
              className="p-2 text-theme-muted hover:text-theme-main rounded-lg hover:bg-[var(--glass-hover)] transition-colors"
              title="Options"
            >
              <MoreVertical size={17} />
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

                  {/* Chat Wallpaper Option */}
                  <button
                    onClick={() => {
                      setIsWallpaperOpen(true);
                      setShowChatOptions(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center gap-2.5 text-theme-main hover:text-accent-primary transition-colors"
                  >
                    <Palette size={14} className="text-accent-primary" /> Chat Wallpaper
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
      </div>

      {/* Call UI */}
      {activeCall && (
        <div className="fixed inset-0 z-50 apple-ambient-bg flex flex-col items-center justify-between py-12 px-6 animate-fadeIn text-theme-main">
          <div className="flex flex-col items-center gap-4 text-center mt-8">
            <div className="relative">
              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.name.replace(/^#/, ""))}&background=2563eb&color=ffffff&size=128`}
                alt="Call" className="w-28 h-28 rounded-full border-2 border-[var(--glass-border)] shadow-2xl object-cover" />
              <span className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-accent-primary flex items-center justify-center shadow-lg text-white">
                {activeCall.type === "video" ? <Video size={13} /> : <Phone size={13} />}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold capitalize text-theme-main">{selectedChat.name.replace(/^#/, "")}</h2>
              <p className="text-[13px] text-theme-muted mt-1">{activeCall.status === "Connected" ? formatCallTime(callDuration) : activeCall.status}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] px-8 py-4 rounded-full mb-8 shadow-glass">
            <button onClick={() => setIsCallMuted(!isCallMuted)} className={`p-4 rounded-full transition-all ${isCallMuted ? "bg-red-500 text-white" : "bg-[var(--glass-hover)] text-theme-main hover:bg-[var(--glass-active)]"}`}>
              {isCallMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            {activeCall.type === "video" && (
              <button onClick={() => setIsVideoDisabled(!isVideoDisabled)} className={`p-4 rounded-full transition-all ${isVideoDisabled ? "bg-red-500 text-white" : "bg-[var(--glass-hover)] text-theme-main hover:bg-[var(--glass-active)]"}`}>
                {isVideoDisabled ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            )}
            <button onClick={() => setIsSpeakerOn(!isSpeakerOn)} className={`p-4 rounded-full transition-all ${isSpeakerOn ? "bg-accent-primary/20 text-accent-primary" : "bg-[var(--glass-hover)] text-theme-muted"}`}>
              <Volume2 size={20} />
            </button>
            <button onClick={endCall} className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg transition-all"><PhoneOff size={20} /></button>
          </div>
        </div>
      )}

      {/* Pinned bar */}
      {currentPinned && (
        <div className="bg-[var(--glass-surface)] backdrop-blur-xl border-b border-[var(--glass-border)] px-4 py-2 flex items-center justify-between z-10">
          <button onClick={() => scrollToMessage(currentPinned._id)} className="flex items-center gap-2.5 text-left flex-1 min-w-0">
            <Pin size={12} className="text-accent-primary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-medium text-accent-primary tracking-wide">PINNED {pinnedMessages.length > 1 && `${pinnedIndex + 1}/${pinnedMessages.length}`}</span>
              <p className="text-[12px] text-theme-main truncate">{currentPinned.text || (currentPinned.image ? "📷 Photo" : "Attachment")}</p>
            </div>
          </button>
          <div className="flex items-center gap-1">
            {pinnedMessages.length > 1 && (
              <button onClick={() => setPinnedIndex((p) => (p + 1) % pinnedMessages.length)} className="p-1 text-theme-muted hover:text-theme-main rounded-lg hover:bg-[var(--glass-hover)]"><ChevronRight size={14} /></button>
            )}
            <button onClick={() => togglePinMessage(currentPinned._id)} className="p-1 text-theme-muted hover:text-red-400 rounded-lg hover:bg-red-500/10"><PinOff size={13} /></button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} onScroll={handleContainerScroll} className="flex-1 overflow-y-auto p-3 md:p-6">
        <div className="flex justify-center my-3">
          <div className="bg-[var(--glass-surface)] backdrop-blur-xl border border-[var(--glass-border)] rounded-full px-3.5 py-1.5 text-[10px] text-theme-muted flex items-center gap-2 shadow-sm">
            <Lock size={10} className="text-accent-primary" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
        <div className="flex justify-center my-2">
          <span className="bg-[var(--glass-surface)] border border-[var(--glass-border)] text-theme-muted text-[10px] font-medium px-3 py-1 rounded-full tracking-wide shadow-sm">Today</span>
        </div>

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
          <div className="space-y-2.5">
            {displayedMessages.map((message) => {
              const isMine = message.senderId._id === authUser._id || message.senderId === authUser._id;
              const sender = message.senderId;
              const reactionGroups = (message.reactions || []).reduce((acc, r) => {
                acc[r.emoji] = acc[r.emoji] || { emoji: r.emoji, count: 0, users: [], hasReacted: false };
                acc[r.emoji].count += 1;
                acc[r.emoji].users.push(r.username || "User");
                if (r.userId === authUser._id || r.userId?._id === authUser._id) acc[r.emoji].hasReacted = true;
                return acc;
              }, {});
              const isReadByRecipient = selectedChat.type === "user" && (message.readBy || []).includes(selectedChat.id);
              const isStarred = (message.starredBy || []).some((id) => (id?._id || id) === authUser._id);

              return (
                <Fragment key={message._id}>
                  <div id={`msg-${message._id}`}
                    onMouseEnter={() => setHoveredMessageId(message._id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    className={`flex max-w-full relative group transition-all ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[85%] md:max-w-[65%]`}>
                      <div className={`flex items-center gap-1.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                        {/* Message Bubble */}
                        <div 
                          style={
                            !message.isDeleted
                              ? isMine
                                ? { background: 'var(--bubble-outgoing-gradient)', color: 'var(--bubble-outgoing-text)' }
                                : { background: 'var(--bubble-incoming-surface)', color: 'var(--bubble-incoming-text)' }
                              : {}
                          }
                          className={`py-2 px-3 rounded-2xl relative transition-all ${
                            message.isDeleted
                              ? "bg-[var(--glass-hover)] text-theme-muted/40 italic"
                              : isMine
                              ? "rounded-tr-sm shadow-md border border-white/25 border-t-[var(--glass-border-specular)] shadow-glass"
                              : "backdrop-blur-2xl border border-[var(--bubble-incoming-border)] border-t-[var(--glass-border-specular)] rounded-tl-sm shadow-glass"
                          }`}
                        >
                          {!isMine && selectedChat.type === "room" && !message.isDeleted && (
                            <p className={`text-[11px] font-semibold mb-0.5 ${getSenderColor(sender.username)}`}>{sender.username}</p>
                          )}
                          {(message.isAiResponse || sender.username === "Pulse AI") && !message.isDeleted && (
                            <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500/25 to-teal-500/25 text-emerald-400 border border-emerald-500/35 mb-1.5 shadow-sm">
                              <Bot size={11} />
                              <span>Pulse AI</span>
                            </div>
                          )}
                          {message.isEncrypted && !message.isDeleted && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-1.5 shadow-sm">
                              <Lock size={10} />
                              <span>E2EE Encrypted</span>
                            </div>
                          )}
                          {message.isPinned && !message.isDeleted && (
                            <div className="flex items-center gap-1 text-[9px] text-amber-400 font-medium mb-1 pb-1 border-b border-white/[0.10]">
                              <Pin size={9} /> Pinned
                            </div>
                          )}
                          {message.isForwarded && !message.isDeleted && (
                            <div className="flex items-center gap-1 text-[9px] italic opacity-60 mb-1">
                              <Forward size={10} /> Forwarded
                            </div>
                          )}
                          {message.replyTo && !message.isDeleted && (
                            <div onClick={() => message.replyTo.messageId && scrollToMessage(message.replyTo.messageId)}
                              className={`mb-1.5 p-2 rounded-xl cursor-pointer transition-colors text-[11px] select-none ${isMine ? "bg-black/20 border-l-2 border-white/80" : "bg-[var(--glass-hover)] border-l-2 border-accent-primary"}`}>
                              <span className={`font-semibold block text-[10px] ${isMine ? "text-white" : "text-accent-primary"}`}>{message.replyTo.senderName || "User"}</span>
                              <p className="opacity-80 truncate">{message.replyTo.text || (message.replyTo.image ? "📷 Photo" : "Attachment")}</p>
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
                                <div className="mb-2 p-2.5 rounded-xl bg-[var(--glass-hover)] border border-[var(--glass-border)] flex items-center justify-between gap-3 max-w-xs">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="p-2 rounded-lg bg-accent-primary/20 text-accent-primary flex-shrink-0"><FileText size={16} /></div>
                                    <div className="min-w-0">
                                      <p className="text-[12px] font-medium truncate">{message.file.name}</p>
                                      <p className="text-[10px] opacity-60">{formatFileSize(message.file.size)}</p>
                                    </div>
                                  </div>
                                  <a href={message.file.url} target="_blank" rel="noreferrer" download={message.file.name}
                                    className="p-1.5 rounded-lg bg-[var(--glass-hover)] hover:bg-[var(--glass-active)] text-accent-primary transition-colors flex-shrink-0"><Download size={12} /></a>
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
                                <div className="text-[13px] leading-relaxed break-words pr-12">
                                  <FormattedMessageText text={message.decryptedText || message.text} isMine={isMine} searchQuery={searchQuery} />
                                </div>
                              )}
                              {message.linkPreview && (
                                <LinkPreviewCard preview={message.linkPreview} isMine={isMine} />
                              )}
                              <div className="flex items-center justify-end gap-1 -mt-1 float-right ml-2 select-none">
                                {message.isEdited && <span className={`text-[9px] italic ${isMine ? "text-white/60" : "opacity-50"}`}>(edited)</span>}
                                <span className={`text-[10px] ${isMine ? "text-white/70" : "opacity-60"}`}>
                                  {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                {isMine && !message.isDeleted && (
                                  <span title={isReadByRecipient ? "Read" : "Delivered"}>
                                    <CheckCheck size={13} className={isReadByRecipient ? "text-white font-bold" : "text-white/50"} />
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Hover actions */}
                        {!message.isDeleted && (
                          <div className="relative flex items-center gap-0.5 flex-shrink-0">
                            <button type="button" onClick={(e) => { e.stopPropagation(); setActivePickerId(activePickerId === message._id ? null : message._id); }}
                              className={actionBtnClass(hoveredMessageId === message._id || activePickerId === message._id)} title="React"><SmilePlus size={12} /></button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); openThread(message); }}
                              className={actionBtnClass(hoveredMessageId === message._id)} title="Reply in Thread"><MessageSquare size={12} /></button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setReplyingTo(message); }}
                              className={actionBtnClass(hoveredMessageId === message._id)} title="Reply"><Reply size={12} /></button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); toggleStarMessage(message._id); }}
                              className={`p-1.5 rounded-full bg-[var(--glass-heavy)] border border-[var(--glass-border)] shadow-sm transition-all duration-150 cursor-pointer ${
                                isStarred ? "opacity-100 scale-100 text-amber-400 pointer-events-auto" : hoveredMessageId === message._id ? "opacity-100 scale-100 text-theme-muted hover:text-amber-400 pointer-events-auto" : "opacity-0 scale-75 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto text-theme-muted hover:text-amber-400"
                              }`} title={isStarred ? "Unstar" : "Star"}>
                              <Star size={12} className={isStarred ? "fill-amber-400" : ""} />
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setForwardingMessage(message); }}
                              className={actionBtnClass(hoveredMessageId === message._id)} title="Forward"><Forward size={12} /></button>
                            {isMine && <button type="button" onClick={(e) => { e.stopPropagation(); setEditingMessage(message); }}
                              className={actionBtnClass(hoveredMessageId === message._id)} title="Edit"><Edit3 size={12} /></button>}
                            <button type="button" onClick={(e) => { e.stopPropagation(); togglePinMessage(message._id); }}
                              className={`p-1.5 rounded-full bg-[var(--glass-heavy)] border border-[var(--glass-border)] shadow-sm transition-all duration-150 cursor-pointer ${
                                message.isPinned ? "opacity-100 scale-100 text-accent-primary pointer-events-auto" : hoveredMessageId === message._id ? "opacity-100 scale-100 text-theme-muted hover:text-accent-primary pointer-events-auto" : "opacity-0 scale-75 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto text-theme-muted hover:text-accent-primary"
                              }`} title={message.isPinned ? "Unpin" : "Pin"}>
                              <Pin size={12} className={message.isPinned ? "fill-accent-primary" : ""} />
                            </button>
                            {isMine && <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(message._id); }}
                              className={`p-1.5 rounded-full bg-[var(--glass-heavy)] border border-[var(--glass-border)] text-theme-muted hover:text-red-400 shadow-sm transition-all duration-150 cursor-pointer ${
                                hoveredMessageId === message._id ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-75 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto"
                              }`} title="Delete"><Trash2 size={12} /></button>}

                            {activePickerId === message._id && (
                              <div onClick={(e) => e.stopPropagation()}
                                className={`absolute bottom-full mb-1.5 ${isMine ? "right-0" : "left-0"} z-30 bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-full px-2 py-1 flex items-center gap-1 shadow-glass animate-fadeIn`}>
                                {QUICK_REACTIONS.map((emoji) => (
                                  <button key={emoji} type="button" onClick={() => { reactToMessage(message._id, emoji); setActivePickerId(null); }}
                                    className="hover:scale-125 transition-transform text-base p-1">{emoji}</button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFullReactionPickerMsgId(fullReactionPickerMsgId === message._id ? null : message._id);
                                  }}
                                  className="p-1 rounded-full text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-all flex items-center justify-center ml-0.5"
                                  title="All emojis"
                                >
                                  <Plus size={13} />
                                </button>
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
                              className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                                grp.hasReacted ? "bg-accent-primary/20 border-accent-primary/40 text-accent-primary font-medium" : "bg-[var(--glass-surface)] border-[var(--glass-border)] text-theme-muted hover:bg-[var(--glass-hover)] hover:text-theme-main"
                              }`}>
                              <span>{grp.emoji}</span><span className="text-[10px]">{grp.count}</span>
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
        )}
      </div>

      {/* Typing indicator */}
      {activeTypers.length > 0 && (
        <div className="px-5 py-2 flex items-center gap-2 text-[12px] text-accent-primary bg-[var(--glass-surface)] backdrop-blur-xl border-t border-[var(--glass-border)] animate-fadeIn">
          <div className="flex gap-1 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-bounce" />
          </div>
          <span>{activeTypers.join(", ")} {activeTypers.length === 1 ? "is" : "are"} typing...</span>
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
      {isWallpaperOpen && <WallpaperModal isOpen={isWallpaperOpen} onClose={() => setIsWallpaperOpen(false)} />}
      {isThreadOpen && <ThreadDrawer onClose={() => closeThread()} />}
    </div>
  );
};

export default ChatPane;
