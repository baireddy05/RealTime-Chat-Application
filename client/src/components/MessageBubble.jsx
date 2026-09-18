import { memo, Fragment, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader, Ban, Clock, Star, Reply, CheckCheck, Pin, Forward, Flame, Plus, MoreVertical, MessageCircle, Edit3, MessageSquare, Info, Trash2, Copy, ChevronDown } from "lucide-react";
import FormattedMessageText from "./FormattedMessageText";
import LinkPreview from "./LinkPreview";
import AudioMessagePlayer from "./AudioMessagePlayer";
import ContactCard from "./ContactCard";
import SwipeableMessage from "./SwipeableMessage";
import { isOnlyEmojis, EmojiSpan } from "../lib/emoji";
import { useChatStore } from "../store/useChatStore";

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

const MessageBubble = memo(({
  message,
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
  const isMine = message.senderId._id === authUser._id || message.senderId === authUser._id;
  const sender = message.senderId;

  // Long press handling for touch devices (mobile) & context menu support
  const bubbleRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const isLongPressTriggeredRef = useRef(false);
  const [isViewingWhisper, setIsViewingWhisper] = useState(false);

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
      
      // If we are not in selection mode, enter selection mode on long press
      if (!isSelectionMode && typeof toggleSelection === 'function') {
        toggleSelection(message._id);
        return;
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
    
    if (!isSelectionMode && typeof toggleSelection === 'function') {
      toggleSelection(message._id);
      return;
    }
    
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

  const readObj = (message.reads || []).find(r => r.userId === selectedChat.id);
  const isReadByRecipient = selectedChat.type === "user" && authUser.readReceipts !== false && (readObj || (message.readBy || []).includes(selectedChat.id));
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
  const isJustEmoji = !message.isDeleted && !message.image && !message.file && !message.audio && !message.contact && !message.replyTo && !message.isForwarded && !message.isPinned && isOnlyEmojis(message.decryptedText || message.text);
  const isSticker = message.isSticker || Boolean(message.image && (message.image.includes("/stickers/") || message.image.includes("giphy-preview.gif") || message.image.includes("sticker")));
  const isStickerOnly = !message.isDeleted && isSticker && (!message.text || !message.text.trim()) && !message.file && !message.audio && !message.contact && !message.replyTo && !message.isForwarded && !message.isPinned;
  const isTransparentBubble = isJustEmoji || isStickerOnly;
  const isVisuallyDeleted = message.isDeleted && !isViewingWhisper;

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
        onReply={() => setReplyingTo(message)}
        disabled={message.isDeleted || message.isOptimistic}
      >
        <div
          id={`msg-${message._id}`}
          onMouseEnter={() => setHoveredMessageId(message._id)}
          onMouseLeave={() => setHoveredMessageId(null)}
          className={`flex max-w-full relative transition-all px-4 sm:px-6 md:px-8 ${
            isSameSenderAsPrev ? "mt-1" : "mt-3.5"
          } mb-0.5 ${isMine ? "justify-end" : "justify-start"}`}
        >
          {!isMine && selectedChat.type === "room" && !isSelectionMode && (
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
                  if (isSelectionMode) {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSelection(message._id);
                    return;
                  }
                  if (isLongPressTriggeredRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
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
                        setIsViewingWhisper(true);
                        useChatStore.getState().viewWhisper(message._id);
                      }}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        setIsViewingWhisper(false);
                      }}
                      onPointerCancel={(e) => {
                        e.stopPropagation();
                        setIsViewingWhisper(false);
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
                      {message.image && (
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
                                  <span 
                                    title={statusTitle}
                                    className={`material-symbols-outlined text-[13px] cursor-help ${isReadByRecipient ? "font-bold opacity-100 text-blue-400" : "font-semibold text-white/90"}`}
                                  >
                                    {isReadByRecipient || isDeliveredToRecipient ? "done_all" : "done"}
                                  </span>
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
                      {message.audio && <div className="mb-0.5"><AudioMessagePlayer audioUrl={message.audio} isMine={isMine} /></div>}
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
                        <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1 max-w-full min-w-0">
                          <div className={`${isJustEmoji ? "text-[42px] leading-tight emoji-text drop-shadow-md" : "text-[15.5px] leading-relaxed break-words [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap font-normal min-w-0 max-w-full"}`}>
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
                              <span 
                                title={statusTitle}
                                className={`material-symbols-outlined text-sm cursor-help ${isReadByRecipient ? "font-bold opacity-100 text-blue-500" : "font-semibold"}`}
                              >
                                {isReadByRecipient || isDeliveredToRecipient ? "done_all" : "done"}
                              </span>
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
                          className="w-[220px] p-1.5 rounded-2xl bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-2xl animate-scaleIn select-none max-w-[calc(100vw-24px)]"
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
                                setReplyingTo(message);
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

                            {selectedChat.type === "room" && (
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
                            )}
                            
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
                          </div>
                        </div>
                      </>,
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
    prevProps.downloadingFileId === nextProps.downloadingFileId
  );
});

export default MessageBubble;

