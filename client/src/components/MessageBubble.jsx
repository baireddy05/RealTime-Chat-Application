import { memo, Fragment, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader, Ban, Clock, Star, Reply, Check, CheckCheck, Pin, Forward, Flame, Plus, MessageCircle, Edit3, Trash2, Copy, ChevronDown, Languages, Volume2, VolumeX, X, EyeOff } from "lucide-react";
import FormattedMessageText from "./FormattedMessageText";
import LinkPreview from "./LinkPreview";
import AudioMessagePlayer from "./AudioMessagePlayer";
import ContactCard from "./ContactCard";
import SwipeableMessage from "./SwipeableMessage";
import MessageTicks from "./MessageTicks";
import { isOnlyEmojis, EmojiSpan } from "../lib/emoji";
import { useChatStore } from "../store/useChatStore";

const SUPPORTED_TRANSLATION_LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "te", name: "Telugu", flag: "🇮🇳" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "pt", name: "Portuguese", flag: "🇧🇷" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
];

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

const formatFileSize = (bytes) => {
  if (!bytes) return "";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
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

// Live/static shared location card. Live pins refresh over sockets and show
// a LIVE badge + Stop control (sender side) until liveUntil passes.
const LiveLocationCard = memo(({ message, isMine }) => {
  const [, forceTick] = useState(0);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (!message.liveUntil) return;
    const t = setInterval(() => forceTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, [message.liveUntil, message._id]);

  const live = message.liveUntil && new Date(message.liveUntil).getTime() > Date.now();
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${message.location.lat},${message.location.lng}`;

  const handleStop = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (stopping) return;
    setStopping(true);
    await useChatStore.getState().stopLiveLocation(message._id);
    setStopping(false);
  };

  return (
    <div className="mb-1 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-black/5 dark:bg-white/5 p-1 w-[200px] sm:w-[240px]">
      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="block w-full h-32 rounded-xl bg-cover bg-center relative group overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0f766e 0%, #115e59 45%, #134e4a 100%)" }}
      >
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.35), transparent 55%), radial-gradient(circle at 75% 80%, rgba(255,255,255,0.2), transparent 50%)" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {live && <span className="absolute -inset-2 rounded-full bg-red-500/30 animate-ping" />}
            <div className={`w-10 h-10 rounded-full ${live ? "bg-red-500" : "bg-accent-primary"} flex items-center justify-center shadow-lg text-white relative`}>
              <span className="material-symbols-outlined">location_on</span>
            </div>
          </div>
        </div>
        {live && (
          <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold tracking-wider flex items-center gap-1 shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
          </span>
        )}
      </a>
      <div className="px-2 py-1.5 flex items-center justify-between gap-2 text-[10px] text-theme-muted">
        <span className="truncate">
          {live
            ? `Live location • until ${new Date(message.liveUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "Location"}
        </span>
        {live && isMine && (
          <button
            type="button"
            onClick={handleStop}
            disabled={stopping}
            className="shrink-0 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold hover:bg-red-500/25 disabled:opacity-50 transition-colors"
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
});

const MessageBubble = memo(({
  message: msgProp,
  index,
  currentList,
  authUser,
  selectedChat,
  searchQuery,
  isMenuOpen,
  setOpenMenuMessageId,
  setMenuAnchor,
  setHoveredMessageId,
  setActivePickerId,
  setFullReactionPickerMsgId,
  reactToMessage,
  setReplyingTo,
  toggleStarMessage,
  setEditingMessage,
  deleteMessage,
  forwardMessage,
  togglePinMessage,
  setRemindMessage,
  onCreateTask,
  openMessageInfo,
  setActiveImage,
  setDownloadingFileId,
  downloadingFileId,
  downloadFile,
  scrollToMessage,
  getMenuPositionStyle,
  isSelectionMode,
  isSelected,
  toggleSelection
}) => {
  const [isViewingWhisper, setIsViewingWhisper] = useState(false);
  const [whisperContent, setWhisperContent] = useState(null);
  const [translatedData, setTranslatedData] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslatePicker, setShowTranslatePicker] = useState(false);
  const [openingViewOnce, setOpeningViewOnce] = useState(false);
  const [openedAudioUrl, setOpenedAudioUrl] = useState(null);

  const handleTranslate = async (targetLang = "en") => {
    setIsTranslating(true);
    setOpenMenuMessageId(null);
    setMenuAnchor(null);
    setShowTranslatePicker(false);
    const textToTranslate = message.decryptedText || message.text;
    if (!textToTranslate || typeof textToTranslate !== "string" || !textToTranslate.trim()) {
      setIsTranslating(false);
      return;
    }
    try {
      const { axiosInstance } = await import("../lib/axios");
      const res = await axiosInstance.post(`/chat/message/${message._id}/translate`, {
        targetLanguage: targetLang,
        text: textToTranslate,
      });
      if (res.data?.translatedText) {
        setTranslatedData({
          text: res.data.translatedText,
          targetLang: res.data.targetLanguage || targetLang,
          sourceLang: res.data.sourceLanguage || "auto",
        });
      }
    } catch (err) {
      console.error("Translation failed:", err);
      alert("Translation failed. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleToggleSpeech = () => {
    setOpenMenuMessageId(null);
    setMenuAnchor(null);
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const textToRead = message.decryptedText || message.text || "";
    if (!textToRead.trim()) return;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Shadow the message prop so we can view the local copy while holding
  const message = isViewingWhisper && whisperContent ? { ...msgProp, ...whisperContent } : msgProp;

  const isMine = (message.senderId?._id || message.senderId) === authUser._id || message.senderId?._id === authUser._id;
  const sender = message.senderId || {};

  // @mention highlight names for group chats (render-time only, E2EE-safe)
  const mentionNames =
    selectedChat?.type === "room"
      ? (selectedChat.members || []).map((m) => m?.username).filter(Boolean)
      : [];

  // View-once media: recipients see a placeholder until they tap to open.
  // Opening fetches the one-time URL and immediately hides the payload locally
  // (the server tombstones it and notifies everyone else over sockets).
  const isViewOnce = !!message.viewOnce && !message.isDeleted;
  const viewOnceOpened = !!message.viewOnceOpened;
  const viewOnceUnopenedImage = isViewOnce && !isMine && !viewOnceOpened && !!message.image;
  const viewOnceUnopenedAudio =
    isViewOnce && !isMine && !viewOnceOpened && !!message.audio && !openedAudioUrl;
  const viewOnceConsumedVisible =
    isViewOnce && !isMine && viewOnceOpened && !message.image && !message.audio && !openedAudioUrl;

  const handleOpenViewOnce = async () => {
    if (openingViewOnce) return;
    setOpeningViewOnce(true);
    try {
      const res = await useChatStore.getState().viewOnceMedia(message._id);
      if (res.success && res.url) {
        useChatStore.setState((state) => ({
          messages: (state.messages || []).map((m) =>
            m._id === message._id ? { ...m, image: null, audio: null, viewOnceOpened: true } : m
          ),
        }));
        if (res.type === "image") {
          setActiveImage(res.url);
        } else {
          setOpenedAudioUrl(res.url);
        }
      }
    } finally {
      setOpeningViewOnce(false);
    }
  };

  // Quoting an unopened view-once item must not leak its payload
  const replySafeMessage =
    (viewOnceUnopenedImage || viewOnceUnopenedAudio) && !isMine
      ? { ...message, image: null, audio: null }
      : message;

  // Long press handling for touch devices (mobile) & context menu support
  const bubbleRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const isLongPressTriggeredRef = useRef(false);

  const openOptionsMenuAtElement = (element) => {
    if (message.isDeleted) return;
    const targetEl = element || bubbleRef.current;
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    setOpenMenuMessageId(message._id);
    setMenuAnchor({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      isMine,
    });
    setActivePickerId(null);
  };

  const handleTouchStart = (e) => {
    if (message.isDeleted) return;
    if (e.target.closest("button, a, input, textarea, select, [role='button'], .quick-reaction-btn")) {
      return;
    }
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressTriggeredRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (typeof window !== "undefined" && window.navigator?.vibrate) {
        try {
          window.navigator.vibrate(30);
        } catch {}
      }
      
      openOptionsMenuAtElement(bubbleRef.current || e.currentTarget);
    }, 420);
  };

  const handleTouchMove = (e) => {
    if (!longPressTimerRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (dx > 8 || dy > 8) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressTriggeredRef.current) {
      setTimeout(() => {
        isLongPressTriggeredRef.current = false;
      }, 350);
    }
  };

  const handleContextMenu = (e) => {
    if (message.isDeleted) return;
    e.preventDefault();
    e.stopPropagation();
    
    openOptionsMenuAtElement(bubbleRef.current || e.currentTarget);
  };
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

  const readObj = (message.reads || []).find(r => r.userId === selectedChat?.id);
  const isReadByRecipient = selectedChat?.type === "user" && authUser.readReceipts !== false && (readObj || (message.readBy || []).includes(selectedChat?.id));
  const deliveryObj = (message.deliveries || []).find(d => d.userId === selectedChat?.id);
  const isDeliveredToRecipient = selectedChat?.type === "user" && !!deliveryObj;
  
  let statusTitle = `Sent: ${new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (isDeliveredToRecipient && deliveryObj?.at) {
    statusTitle += `\nDelivered: ${new Date(deliveryObj.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (isReadByRecipient && readObj?.at) {
    statusTitle += `\nSeen: ${new Date(readObj.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  const isStarred = (message.starredBy || []).some((id) => (id?._id || id) === authUser._id);
  const isJustEmoji = !message.isDeleted && !message.image && !message.file && !message.audio && !message.videoNote && !message.location && !message.contact && !message.replyTo && !message.isForwarded && !message.isPinned && isOnlyEmojis(message.decryptedText || message.text);
  const isSticker = message.isSticker || Boolean(message.image && (message.image.includes("/stickers/") || message.image.includes("giphy-preview.gif") || message.image.includes("sticker")));
  const isStickerOnly = !message.isDeleted && isSticker && (!message.text || !message.text.trim()) && !message.file && !message.audio && !message.videoNote && !message.location && !message.contact && !message.replyTo && !message.isForwarded && !message.isPinned;
  const isTransparentBubble = isJustEmoji || isStickerOnly;
  const isVisuallyDeleted = message.isDeleted && !isViewingWhisper;

  // System notices (missed calls, etc.) render as centered pills, not bubbles
  if (message.isSystemMessage) {
    return (
      <Fragment key={message._id}>
        {showDateDivider && (
          <div className="my-3.5 flex items-center justify-center select-none w-full">
            <span className="px-3.5 py-1 rounded-xl bg-black/40 dark:bg-zinc-800/80 backdrop-blur-xl text-zinc-100 dark:text-zinc-200 text-[11px] font-semibold tracking-wide shadow-sm border border-white/10 dark:border-white/5">
              {formatDateDivider(message.createdAt)}
            </span>
          </div>
        )}
        <div
          id={`msg-${message._id}`}
          className="my-1.5 flex items-center justify-center select-none w-full px-4 sm:px-6"
        >
          <span className="px-3 py-1 rounded-full bg-black/30 dark:bg-white/10 backdrop-blur-md text-zinc-200 dark:text-zinc-300 text-[11px] font-medium shadow-sm border border-white/10 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px] text-red-400">call_missed</span>
            <span>{message.decryptedText || message.text || "Missed call"}</span>
            <span className="opacity-60 font-mono text-[10px]">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </span>
        </div>
      </Fragment>
    );
  }

  return (
    <Fragment key={message._id}>
      {/* Dynamic Date Divider */}
      {showDateDivider && (
        <div className="my-3.5 flex items-center justify-center select-none w-full">
          <span className="px-3.5 py-1 rounded-xl bg-black/40 dark:bg-zinc-800/80 backdrop-blur-xl text-zinc-100 dark:text-zinc-200 text-[11px] font-semibold tracking-wide shadow-sm border border-white/10 dark:border-white/5">
            {formatDateDivider(message.createdAt)}
          </span>
        </div>
      )}
      <SwipeableMessage
        onReply={() => setReplyingTo(replySafeMessage)}
        disabled={message.isDeleted || message.isOptimistic}
      >
        <div
          id={`msg-${message._id}`}
          onMouseEnter={() => setHoveredMessageId(message._id)}
          onMouseLeave={() => setHoveredMessageId(null)}
          className={`msg-row flex max-w-full relative transition-all px-4 sm:px-6 md:px-8 ${
            isSameSenderAsPrev ? "mt-1" : "mt-3.5"
          } mb-0.5 ${isMine ? "justify-end" : "justify-start"}`}
        >
          {!isMine && selectedChat?.type === "room" && !isSelectionMode && (
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

          {isSelectionMode && (
            <div 
              className="flex items-center justify-center mr-3 self-center cursor-pointer"
              onClick={() => toggleSelection(message._id)}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                isSelected ? "bg-accent-primary border-accent-primary" : "border-outline hover:border-accent-primary/50"
              }`}>
                {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
              </div>
            </div>
          )}

          <div className={`flex flex-col ${isMine && !isSelectionMode ? "items-end" : "items-start"} max-w-[85%] md:max-w-[70%] min-w-0 flex-1`}>
            <div className={`flex items-center gap-1.5 group ${isMine && !isSelectionMode ? "flex-row-reverse" : "flex-row"} max-w-full min-w-0`}>
              {/* Speech Bubble */}
              <div 
                ref={bubbleRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onContextMenu={handleContextMenu}
                onClickCapture={(e) => {
                  if (isLongPressTriggeredRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  if (isSelectionMode) {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSelection(msgProp._id);
                    return;
                  }
                }}
                style={
                  !isVisuallyDeleted
                    ? isTransparentBubble
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
                className={`message-bubble-touch ${isTransparentBubble ? "py-0 px-0" : "py-2 px-3.5"} ${bubbleRadius} relative group/bubble transition-all w-fit max-w-full min-w-0 ${
                  message.isDeleted
                    ? "bg-surface-container/40 text-outline italic"
                    : isMine && !isTransparentBubble
                    ? "border border-black/10 dark:border-white/40 shadow-sm"
                    : ""
                } ${
                  message.isOptimistic || (isMine && index === currentList.length - 1 && (Date.now() - new Date(message.createdAt).getTime() < 3500))
                    ? "animate-outgoing-glide"
                    : ""
                }`}
              >
                {/* Embedded Thread Context if parent message is supplied */}
                {message.parentMessageId && typeof message.parentMessageId === 'object' && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollToMessage(message.parentMessageId._id);
                    }}
                    className="mb-2 p-1.5 rounded-lg cursor-pointer transition-colors text-[10px] select-none bg-current/10 border-l-2 border-current/50 opacity-80 hover:opacity-100 flex items-center gap-1.5"
                  >
                    <MessageCircle size={10} className="shrink-0" />
                    <span className="truncate">Thread: {message.parentMessageId.decryptedText || message.parentMessageId.text || "Message"}</span>
                  </div>
                )}
                
                {/* Bubble Content Area */}
                <div className="relative z-10 flex flex-col w-full min-w-0 max-w-full">
                  {!isMine && selectedChat?.type === "room" && !message.isDeleted && !isSameSenderAsPrev && (
                    <p className={`text-[11.5px] font-bold mb-1 tracking-tight ${getSenderColor(sender?.username)}`}>{sender?.username || "User"}</p>
                  )}
                  {message.isPinned && !message.isDeleted && (
                    <div className="flex items-center gap-1 text-[9px] font-medium mb-1 pb-1 border-b border-current/15 opacity-75">
                      <Pin size={9} /> Pinned
                    </div>
                  )}
                  {message.isAnnouncement && !message.isDeleted && (
                    <div className="flex items-center gap-1 text-[9px] font-bold mb-1 pb-1 border-b border-current/15 text-amber-500">
                      <span className="material-symbols-outlined text-[11px]">campaign</span> Announcement
                    </div>
                  )}
                  {message.isForwarded && !message.isDeleted && (
                    <div className="flex items-center gap-1 text-[9px] italic mb-1 opacity-75">
                      <Forward size={10} /> Forwarded
                    </div>
                  )}
                  {message.isBroadcast && !message.isDeleted && (
                    <div className="flex items-center gap-1 text-[9px] italic mb-1 opacity-75">
                      <span className="material-symbols-outlined text-[11px]">campaign</span> Broadcast
                    </div>
                  )}
                  {message.replyTo && !message.isDeleted && (
                    <div onClick={() => message.replyTo.messageId && scrollToMessage(message.replyTo.messageId)}
                      className="mb-1.5 p-2 rounded-xl cursor-pointer transition-colors text-[11px] select-none bg-current/5 border-l-2 border-current/40 flex items-center gap-2">
                      {message.replyTo.image && (
                        <img src={message.replyTo.image} alt="Reply preview" className="w-8 h-8 rounded object-cover flex-shrink-0 bg-black/10 dark:bg-white/10" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold block text-[10px] opacity-90">{message.replyTo.senderName || "User"}</span>
                        <p className="truncate opacity-75">{message.replyTo.decryptedText || message.replyTo.text || (message.replyTo.image ? "📷 Photo" : message.replyTo.file ? `📎 ${message.replyTo.file.name}` : message.replyTo.contact ? `👤 Contact: ${message.replyTo.contact.fullName || message.replyTo.contact.username || "Contact"}` : "Attachment")}</p>
                      </div>
                    </div>
                  )}
                  {isVisuallyDeleted ? (
                    <div className="flex items-center gap-2 text-[12px] py-0.5">
                      <Ban size={12} /> {message.text === "This whisper has vanished." ? "This whisper has vanished." : "This message was deleted"}
                    </div>
                  ) : message.isWhisper && !isMine && !isViewingWhisper ? (
                    <div 
                      className="flex flex-col items-center justify-center p-6 gap-3 min-w-[200px] cursor-pointer active:scale-95 transition-transform select-none"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        // Save content so it doesn't vanish instantly from UI when the server deletes it
                        setWhisperContent({
                          text: msgProp.decryptedText || msgProp.text,
                          image: msgProp.image,
                          audio: msgProp.audio,
                          file: msgProp.file
                        });
                        setIsViewingWhisper(true);
                        useChatStore.getState().viewWhisper(msgProp._id);
                      }}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        setIsViewingWhisper(false);
                        setWhisperContent(null);
                      }}
                      onPointerCancel={(e) => {
                        e.stopPropagation();
                        setIsViewingWhisper(false);
                        setWhisperContent(null);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                      }}
                    >
                      <div className="w-14 h-14 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center animate-pulse">
                        <span className="material-symbols-outlined text-[32px]">visibility_off</span>
                      </div>
                      <span className="text-xs font-semibold text-center opacity-80">
                        Press and hold to<br/>reveal whisper
                      </span>
                    </div>
                  ) : (
                    <>
                      {message.isWhisper && isMine && (
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold opacity-60 mb-1">
                          <span className="material-symbols-outlined text-[12px]">visibility_off</span> Whisper
                        </div>
                      )}
                      {isViewOnce && isMine && (
                        <div className="mb-1 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
                          <span className="material-symbols-outlined text-[11px]">counter_1</span>
                          View once
                        </div>
                      )}
                      {viewOnceUnopenedImage && (
                        <button
                          type="button"
                          onClick={handleOpenViewOnce}
                          disabled={openingViewOnce}
                          className="mb-1.5 w-44 sm:w-52 h-40 sm:h-48 rounded-2xl border border-[var(--glass-border)] bg-black/10 dark:bg-white/5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-black/15 dark:hover:bg-white/10 active:scale-[0.99] transition-all disabled:opacity-60"
                        >
                          <span className="w-11 h-11 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center">
                            <span className={`material-symbols-outlined text-[22px] ${openingViewOnce ? "animate-spin" : ""}`}>
                            {openingViewOnce ? "progress_activity" : "visibility"}
                          </span>
                          </span>
                          <span className="text-[11px] font-semibold text-theme-main">
                            {openingViewOnce ? "Opening…" : "View once"}
                          </span>
                          <span className="text-[10px] text-theme-muted">Tap to view — opens a single time</span>
                        </button>
                      )}
                      {viewOnceConsumedVisible && (
                        <div className="flex items-center gap-1.5 text-[11px] opacity-60 italic py-0.5 select-none">
                          <span className="material-symbols-outlined text-[13px]">visibility_off</span>
                          View-once media opened
                        </div>
                      )}
                      {message.image && !viewOnceUnopenedImage && (
                        isStickerOnly ? (
                          <div className="relative group/sticker my-0.5 flex flex-col items-end">
                            <img
                              src={message.image}
                              alt="Sticker"
                              loading="lazy"
                              onClick={() => setActiveImage(message.image)}
                              className="w-32 h-32 xs:w-36 xs:h-36 sm:w-44 sm:h-44 object-contain bg-transparent select-none cursor-pointer hover:scale-105 transition-transform duration-200 drop-shadow-md"
                            />
                            <div className="flex items-center gap-1 text-[9.5px] px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-white/90 shadow-sm mt-1 select-none">
                              <span>
                                {new Date(message.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {isMine && !message.isDeleted && (
                                message.isOptimistic ? (
                                  <Clock size={11} className="opacity-70 animate-pulse text-white" title="Sending..." />
                                ) : (
                                  <MessageTicks
                                    status={isReadByRecipient ? "read" : isDeliveredToRecipient ? "delivered" : "sent"}
                                    title={statusTitle}
                                    size={13}
                                    className="text-white/90"
                                  />
                                )
                              )}
                            </div>
                          </div>
                        ) : (
                          (() => {
                            const isGif = message.image && (message.image.toLowerCase().includes('.gif') || message.image.toLowerCase().includes('tenor.com'));
                            return (
                              <div className={`overflow-hidden rounded-2xl mb-1.5 max-w-full ${isGif ? 'sm:max-w-[260px] md:max-w-[280px]' : 'sm:max-w-[360px] md:max-w-[420px]'}`}>
                                <img
                                  src={message.image}
                                  alt="Attachment"
                                  loading="lazy"
                                  onClick={() => setActiveImage(message.image)}
                                  className={`w-auto h-auto max-w-full ${isGif ? 'max-h-[240px] sm:max-h-[280px]' : 'max-h-[380px] sm:max-h-[460px]'} object-contain rounded-2xl cursor-pointer hover:opacity-95 transition-all active:scale-[0.99] shadow-sm block bg-black/5 dark:bg-white/5`}
                                />
                              </div>
                            );
                          })()
                        )
                      )}
                      {message.file && (
                        <div
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              setDownloadingFileId(message._id);
                              await downloadFile(message.file.url, message.file.name);
                            } catch (err) {
                              alert(`Couldn't download "${message.file.name || "file"}": ${err?.message || "unknown error"}`);
                            } finally {
                              setDownloadingFileId(null);
                            }
                          }}
                          className="flex items-center justify-between p-2.5 rounded-xl transition-all border my-1 max-w-sm bg-current/5 border-current/10 hover:bg-current/10 cursor-pointer active:scale-[0.99] group/doc"
                          title="Click to download / view document"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/20 text-red-500 dark:text-red-400 shrink-0 group-hover/doc:scale-105 transition-transform">
                              <span className="material-symbols-outlined text-xl">picture_as_pdf</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold truncate opacity-95 group-hover/doc:text-accent-primary transition-colors">
                                {message.file.name}
                              </span>
                              <span className="text-[11px] font-mono opacity-70">
                                {formatFileSize(message.file.size)} • Document
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                setDownloadingFileId(message._id);
                                await downloadFile(message.file.url, message.file.name);
                              } catch (err) {
                                alert(`Couldn't download "${message.file.name || "file"}": ${err?.message || "unknown error"}`);
                              } finally {
                                setDownloadingFileId(null);
                              }
                            }}
                            disabled={downloadingFileId === message._id}
                            className="p-2 rounded-lg transition-all ml-2 shrink-0 bg-current/10 hover:bg-current/20 text-current cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center"
                            title="Download Document"
                          >
                            {downloadingFileId === message._id ? (
                              <Loader size={16} className="animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-base">download</span>
                            )}
                          </button>
                        </div>
                      )}
                      {message.contact && (
                        <ContactCard contact={message.contact} isMine={isMine} />
                      )}
                      {viewOnceUnopenedAudio && (
                        <button
                          type="button"
                          onClick={handleOpenViewOnce}
                          disabled={openingViewOnce}
                          className="mb-1.5 min-w-[220px] max-w-[300px] p-3 rounded-2xl border border-[var(--glass-border)] bg-black/10 dark:bg-white/5 flex items-center gap-2.5 cursor-pointer hover:bg-black/15 dark:hover:bg-white/10 active:scale-[0.99] transition-all disabled:opacity-60"
                        >
                          <span className="w-9 h-9 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[18px]">mic</span>
                          </span>
                          <span className="text-left">
                            <span className="block text-[11px] font-semibold text-theme-main">
                              {openingViewOnce ? "Opening…" : "View-once voice note"}
                            </span>
                            <span className="block text-[10px] text-theme-muted">Tap to listen once</span>
                          </span>
                        </button>
                      )}
                      {(message.audio || openedAudioUrl) && !viewOnceUnopenedAudio && (
                        <div className="mb-0.5">
                          <AudioMessagePlayer audioUrl={openedAudioUrl || message.audio} isMine={isMine} />
                        </div>
                      )}
                      {message.videoNote && (
                        <div className="mb-1 overflow-hidden rounded-full w-48 h-48 sm:w-60 sm:h-60 flex items-center justify-center bg-black/10 dark:bg-black/40 border-[3px] border-accent-primary/20 shadow-md">
                          <video src={message.videoNote} controls playsInline loop className="w-full h-full object-cover rounded-full" />
                        </div>
                      )}
                      {message.location && (
                        <LiveLocationCard message={message} isMine={isMine} />
                      )}
                      {message.poll && (
                        <div className={`mt-1 mb-2 p-3 rounded-2xl border ${isMine ? 'bg-black/10 border-white/10 text-white' : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 text-zinc-900 dark:text-zinc-100'}`}>
                          <div className="flex items-start gap-2 mb-3">
                            <span className="material-symbols-outlined text-lg mt-0.5">poll</span>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold leading-tight">{message.poll.question}</span>
                              <span className="text-[10px] opacity-70 mt-0.5 select-none">{message.poll.multipleAnswers ? "Select one or more" : "Select one"}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            {message.poll.options.map((opt, i) => {
                              const totalVotes = message.poll.options.reduce((acc, o) => acc + o.votes.length, 0);
                              const percentage = totalVotes === 0 ? 0 : Math.round((opt.votes.length / totalVotes) * 100);
                              const hasVoted = opt.votes.includes(authUser._id);
                              return (
                                <div key={i} className="relative overflow-hidden rounded-xl bg-black/10 dark:bg-white/10 border border-transparent hover:border-black/20 dark:hover:border-white/20 transition-colors cursor-pointer" onClick={() => {
                                  useChatStore.getState().votePoll(message._id, i);
                                }}>
                                  <div className="absolute top-0 left-0 bottom-0 bg-accent-primary/30 transition-all duration-500 ease-out" style={{ width: `${percentage}%` }} />
                                  <div className="relative z-10 flex items-center justify-between p-2.5">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center transition-colors ${hasVoted ? 'border-accent-primary bg-accent-primary text-white' : 'border-current opacity-50'}`}>
                                        {hasVoted && <span className="material-symbols-outlined text-[10px] font-bold">check</span>}
                                      </div>
                                      <span className="text-xs font-semibold">{opt.text}</span>
                                    </div>
                                    {totalVotes > 0 && (
                                      <div className="flex items-center gap-1.5 opacity-80">
                                        <span className="text-[10px] bg-black/20 dark:bg-white/20 px-1.5 py-0.5 rounded-full">{opt.votes.length}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {message.expiresAt && (
                        <div className="mb-1.5 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-sm animate-pulse">
                          <Flame size={10} />
                          <span>Disappearing Message</span>
                        </div>
                      )}
                      {message.text && (
                        <div className="flex flex-col max-w-full min-w-0">
                          <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1 max-w-full min-w-0">
                            <div className={`${isJustEmoji ? "text-[42px] leading-tight emoji-text drop-shadow-md" : "text-[15.5px] leading-relaxed break-words [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap font-normal min-w-0 max-w-full"}`}>
                              <FormattedMessageText text={message.decryptedText || message.text} isMine={isMine} searchQuery={searchQuery} highlightNames={mentionNames} />
                            </div>
                            <div className="inline-flex items-center gap-1 text-[10px] select-none ml-auto self-end flex-shrink-0 -mb-0.5 pb-0.5 opacity-70">
                              {message.isEdited && <span className="italic text-[9px] opacity-75">(edited)</span>}
                              <span className={isJustEmoji ? "text-theme-muted drop-shadow-sm font-semibold" : ""}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              {isMine && !message.isDeleted && (
                                message.isOptimistic ? (
                                  <Clock size={11} className={`opacity-70 animate-pulse ${isJustEmoji ? "text-theme-muted drop-shadow-sm" : ""}`} title="Sending..." />
                                ) : (
                                  <MessageTicks
                                    status={isReadByRecipient ? "read" : isDeliveredToRecipient ? "delivered" : "sent"}
                                    title={statusTitle}
                                    size={14}
                                    className={isJustEmoji ? "text-theme-muted drop-shadow-sm" : "opacity-70"}
                                  />
                                )
                              )}
                            </div>
                          </div>
                          {isSpeaking && (
                            <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-primary/20 text-accent-primary border border-accent-primary/30 text-[11px] font-semibold animate-pulse">
                              <Volume2 size={12} className="animate-bounce" />
                              <span>Reading aloud...</span>
                              <button
                                type="button"
                                onClick={handleToggleSpeech}
                                className="ml-1 p-0.5 rounded-full hover:bg-white/20 text-white"
                                title="Stop Read Aloud"
                              >
                                <VolumeX size={11} />
                              </button>
                            </div>
                          )}
                          {isTranslating && (
                            <div className="mt-2 pt-2 border-t border-current/15 flex items-center gap-2 text-xs opacity-80 animate-pulse select-none">
                              <Loader size={12} className="animate-spin text-accent-primary" />
                              <span>Translating message...</span>
                            </div>
                          )}
                          {translatedData && (
                            <div className="mt-2.5 pt-2 border-t border-current/20 text-left animate-fadeIn select-text">
                              <div className="flex items-center justify-between gap-1 text-[11px] opacity-90 mb-1 select-none font-medium">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Languages size={13} className="text-accent-primary shrink-0" />
                                  <span className="font-semibold text-accent-primary truncate">
                                    Translated ({SUPPORTED_TRANSLATION_LANGUAGES.find((l) => l.code === translatedData.targetLang)?.name || translatedData.targetLang.toUpperCase()})
                                  </span>
                                  {translatedData.sourceLang && translatedData.sourceLang !== "auto" && (
                                    <span className="opacity-60 text-[9.5px]">from {translatedData.sourceLang.toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setShowTranslatePicker(true)}
                                    className="px-1.5 py-0.5 rounded-md hover:bg-current/10 text-[10px] font-semibold text-accent-primary transition-colors cursor-pointer"
                                    title="Change language"
                                  >
                                    Change
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (navigator.clipboard?.writeText) {
                                        navigator.clipboard.writeText(translatedData.text);
                                      }
                                    }}
                                    className="p-1 rounded-md hover:bg-current/10 transition-colors cursor-pointer"
                                    title="Copy translation"
                                  >
                                    <Copy size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if ('speechSynthesis' in window) {
                                        window.speechSynthesis.cancel();
                                        const u = new SpeechSynthesisUtterance(translatedData.text);
                                        u.lang = translatedData.targetLang;
                                        window.speechSynthesis.speak(u);
                                      }
                                    }}
                                    className="p-1 rounded-md hover:bg-current/10 transition-colors cursor-pointer"
                                    title="Listen to translation"
                                  >
                                    <Volume2 size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setTranslatedData(null)}
                                    className="p-1 rounded-md hover:bg-current/10 transition-colors cursor-pointer opacity-70 hover:opacity-100"
                                    title="Hide translation"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                              <div className="text-[14px] leading-relaxed break-words [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap font-normal">
                                <FormattedMessageText text={translatedData.text} isMine={isMine} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {(() => {
                        const url = extractFirstUrl(message.decryptedText || message.text);
                        return url ? <LinkPreview url={url} /> : null;
                      })()}

                      {!message.text && !isStickerOnly && !isJustEmoji && (
                        <div className="flex items-center justify-end gap-1 mt-1 select-none opacity-70">
                          {message.isEdited && <span className="text-[9px] italic opacity-75">(edited)</span>}
                          <span className="text-[10px] font-medium">
                            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {isMine && !message.isDeleted && (
                            message.isOptimistic ? (
                              <Clock size={11} className="opacity-70 animate-pulse" title="Sending..." />
                            ) : (
                              <MessageTicks
                                status={isReadByRecipient ? "read" : isDeliveredToRecipient ? "delivered" : "sent"}
                                title={statusTitle}
                                size={14}
                              />
                            )
                          )}
                          {message.isEdited && (
                            <span className="text-[10px] italic opacity-60 ml-1 select-none">(edited)</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* WhatsApp-style Hover Menu Trigger */}
                  {!message.isDeleted && (
                    <div
                      role="button"
                      onTouchStart={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isMenuOpen) {
                          setOpenMenuMessageId(null);
                          setMenuAnchor(null);
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setOpenMenuMessageId(message._id);
                          setMenuAnchor({
                            top: rect.top,
                            bottom: rect.bottom,
                            left: rect.left,
                            right: rect.right,
                            isMine,
                          });
                          setActivePickerId(null);
                        }
                      }}
                      className={`hidden md:flex absolute top-1 right-1 items-center justify-center p-0.5 rounded-full bg-black/10 dark:bg-white/10 backdrop-blur-md shadow-sm transition-opacity duration-150 cursor-pointer z-10 ${
                        isMenuOpen
                          ? "opacity-100 pointer-events-auto"
                          : "opacity-0 pointer-events-none group-hover/bubble:opacity-100 group-hover/bubble:pointer-events-auto text-current"
                      }`}
                      title="Message options"
                    >
                      <ChevronDown size={14} className="opacity-80" />
                    </div>
                  )}
                </div>

                {/* Dropdown popover */}
                {!message.isDeleted && isMenuOpen && typeof document !== "undefined" && createPortal(
                  <>
                        <div
                          className="fixed inset-0 z-[9998] bg-transparent"
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            setOpenMenuMessageId(null);
                            setMenuAnchor(null);
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setOpenMenuMessageId(null);
                            setMenuAnchor(null);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuMessageId(null);
                            setMenuAnchor(null);
                          }}
                        />
                        <div
                          onTouchStart={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          style={getMenuPositionStyle()}
                          className="w-[220px] p-1.5 rounded-2xl bg-[rgb(var(--bg-surface-rgb))] border border-[var(--glass-border)] shadow-2xl animate-scaleIn select-none max-w-[calc(100vw-24px)]"
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
                                  setMenuAnchor(null);
                                }}
                                className="hover:scale-125 transition-transform p-1 rounded-lg hover:bg-white/10 quick-reaction-btn flex items-center justify-center text-sm"
                                title={`React ${emoji}`}
                              >
                                <EmojiSpan text={emoji} />
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setFullReactionPickerMsgId(message._id);
                                setOpenMenuMessageId(null);
                                setMenuAnchor(null);
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
                                setReplyingTo(replySafeMessage);
                                setOpenMenuMessageId(null);
                                setMenuAnchor(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                            >
                              <Reply size={14} className="text-theme-muted" />
                              <span>Reply</span>
                            </button>

                            {(message.decryptedText || message.text) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const textToCopy = message.decryptedText || message.text;
                                  if (navigator.clipboard?.writeText) {
                                    navigator.clipboard.writeText(textToCopy);
                                  }
                                  setOpenMenuMessageId(null);
                                  setMenuAnchor(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                              >
                                <Copy size={14} className="text-theme-muted" />
                                <span>Copy Text</span>
                              </button>
                            )}

                            {(message.decryptedText || message.text) && (
                              <button
                                type="button"
                                onClick={handleToggleSpeech}
                                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                              >
                                {isSpeaking ? (
                                  <>
                                    <VolumeX size={14} className="text-red-400" />
                                    <span className="text-red-400 font-semibold">Stop Read Aloud</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 size={14} className="text-accent-primary" />
                                    <span>Read Aloud (TTS)</span>
                                  </>
                                )}
                              </button>
                            )}

                            {(message.decryptedText || message.text) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuMessageId(null);
                                  setMenuAnchor(null);
                                  setShowTranslatePicker(true);
                                }}
                                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left cursor-pointer"
                              >
                                <Languages size={14} className="text-theme-muted" />
                                <span>Translate Message</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                toggleStarMessage(message._id);
                                setOpenMenuMessageId(null);
                                setMenuAnchor(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                            >
                              <Star size={14} className={isStarred ? "text-amber-400 fill-amber-400" : "text-theme-muted"} />
                              <span>{isStarred ? "Unstar Message" : "Star Message"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                openMessageInfo(message);
                                setOpenMenuMessageId(null);
                                setMenuAnchor(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                            >
                              <CheckCheck size={14} className="text-theme-muted" />
                              <span>Message Info</span>
                            </button>

                            {typeof setRemindMessage === 'function' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRemindMessage(message);
                                  setOpenMenuMessageId(null);
                                  setMenuAnchor(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                              >
                                <Clock size={14} className="text-theme-muted" />
                                <span>Remind Me Later</span>
                              </button>
                            )}

                            {isMine && !message.image && !message.audio && !message.file && !message.contact && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMessage(message);
                                  setOpenMenuMessageId(null);
                                  setMenuAnchor(null);
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
                                togglePinMessage(message._id);
                                setOpenMenuMessageId(null);
                                setMenuAnchor(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                            >
                              <Pin size={14} className="text-theme-muted" />
                              <span>{message.isPinned ? "Unpin Message" : "Pin Message"}</span>
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => {
                                forwardMessage(message);
                                setOpenMenuMessageId(null);
                                setMenuAnchor(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                            >
                              <Forward size={14} className="text-theme-muted" />
                              <span>Forward</span>
                            </button>

                            {typeof onCreateTask === 'function' && (
                              <button
                                type="button"
                                onClick={() => {
                                  onCreateTask(message);
                                  setOpenMenuMessageId(null);
                                  setMenuAnchor(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                              >
                                <span className="material-symbols-outlined text-[15px] text-theme-muted">task_alt</span>
                                <span>Create Task</span>
                              </button>
                            )}

                            {typeof toggleSelection === 'function' && (
                              <button
                                type="button"
                                onClick={() => {
                                  toggleSelection(msgProp._id);
                                  setOpenMenuMessageId(null);
                                  setMenuAnchor(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-theme-main hover:bg-[var(--glass-hover)] rounded-xl transition-colors text-left"
                              >
                                <Check size={14} className="text-theme-muted" />
                                <span>Select Message</span>
                              </button>
                            )}

                            {isMine && (
                              <button
                                type="button"
                                onClick={() => {
                                  deleteMessage(message._id);
                                  setOpenMenuMessageId(null);
                                  setMenuAnchor(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-xl transition-colors text-left"
                              >
                                <Trash2 size={14} />
                                <span>Delete Message</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                useChatStore.getState().hideMessage(message._id);
                                setOpenMenuMessageId(null);
                                setMenuAnchor(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-xl transition-colors text-left"
                            >
                              <EyeOff size={14} />
                              <span>Delete for me</span>
                            </button>
                          </div>
                        </div>
                      </>,
                  document.body
                )}

                {/* Language Selection Modal for Translation */}
                {showTranslatePicker && typeof document !== "undefined" && createPortal(
                  <div
                    onClick={() => setShowTranslatePicker(false)}
                    className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="bg-slate-900 border border-[var(--glass-border)] rounded-3xl w-full max-w-sm shadow-2xl p-4 flex flex-col gap-3 animate-scaleIn text-theme-main"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-accent-primary/20 text-accent-primary flex items-center justify-center">
                            <Languages size={15} />
                          </div>
                          <h3 className="font-semibold text-sm text-white">Translate Message</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowTranslatePicker(false)}
                          className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <p className="text-xs text-zinc-400">Select target language:</p>

                      <div className="grid grid-cols-2 gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                        {SUPPORTED_TRANSLATION_LANGUAGES.map((lang) => (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={() => handleTranslate(lang.code)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-accent-primary/20 hover:text-white text-zinc-200 text-xs font-medium transition-all text-left border border-white/5 hover:border-accent-primary/30 cursor-pointer active:scale-95"
                          >
                            <span className="text-base select-none">{lang.flag}</span>
                            <span className="truncate">{lang.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            </div>

            {/* Reactions Display below the bubble */}
            {Object.keys(reactionGroups).length > 0 && !message.isDeleted && (
              <div className={`flex flex-wrap gap-1 max-w-[280px] sm:max-w-md ${isMine ? "justify-end mr-3 mt-1" : "justify-start ml-3 mt-1"}`}>
                {Object.values(reactionGroups).map((group) => (
                  <button
                    key={group.emoji}
                    type="button"
                    onClick={() => reactToMessage(message._id, group.emoji)}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all shadow-sm border
                      ${group.hasReacted 
                        ? "bg-accent-primary/20 text-accent-primary border-accent-primary/30 scale-[1.02]" 
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high border-[var(--glass-border)]"
                      }
                    `}
                    title={group.users.join(", ")}
                  >
                    <EmojiSpan text={group.emoji} />
                    <span>{group.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </SwipeableMessage>
    </Fragment>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.message === nextProps.message &&
    prevProps.index === nextProps.index &&
    prevProps.isMenuOpen === nextProps.isMenuOpen &&
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.downloadingFileId === nextProps.downloadingFileId &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.isSelected === nextProps.isSelected
  );
});

export default MessageBubble;

