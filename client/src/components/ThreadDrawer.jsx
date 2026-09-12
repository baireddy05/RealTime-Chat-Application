import { useState, useRef, useEffect } from "react";
import {
  X,
  MessageSquare,
  Send,
  Loader,
  Lock,
  Bot,
  Sparkles,
  Paperclip,
  Smile,
  FileText,
  Download,
} from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import AudioMessagePlayer from "./AudioMessagePlayer";
import FormattedMessageText from "./FormattedMessageText";

const ThreadDrawer = ({ onClose }) => {
  const {
    activeThreadMessage,
    threadReplies,
    isThreadLoading,
    sendThreadReply,
    isE2eeEnabled,
    selectedChat,
  } = useChatStore();

  const { authUser } = useAuthStore();
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const repliesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom of thread replies
  useEffect(() => {
    repliesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadReplies]);

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeThreadMessage]);

  if (!activeThreadMessage) return null;

  const parentSender = activeThreadMessage.senderId?.username || "Pulse User";
  const parentAvatar =
    activeThreadMessage.senderId?.profilePic ||
    "https://api.dicebear.com/7.x/bottts/svg?seed=" + parentSender;
  const isParentAi = activeThreadMessage.isAiResponse || parentSender === "Pulse AI";

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!replyText.trim() || isSending) return;

    setIsSending(true);
    const content = replyText.trim();
    setReplyText("");

    await sendThreadReply({
      text: content,
    });
    setIsSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertPulseMention = () => {
    setReplyText((prev) => (prev ? `${prev} @pulse ` : "@pulse "));
    inputRef.current?.focus();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex justify-end animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm sm:max-w-md md:max-w-lg bg-[var(--glass-heavy)] backdrop-blur-2xl h-full shadow-glass border-l border-[var(--glass-border)] flex flex-col animate-slideLeft text-theme-main"
      >
        {/* Drawer Header */}
        <div className="h-16 px-5 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--glass-hover)] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent-primary/15 text-accent-primary border border-accent-primary/25">
              <MessageSquare size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-theme-main">Thread</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--glass-surface)] border border-[var(--glass-border)] text-accent-primary font-medium">
                  {selectedChat?.name || "Chat"}
                </span>
              </div>
              <p className="text-[11px] text-theme-muted">
                {threadReplies.length} {threadReplies.length === 1 ? "reply" : "replies"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Conversation Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Pinned Parent Message Card */}
          <div className="p-4 rounded-2xl bg-[var(--glass-surface)] border border-accent-primary/30 shadow-md relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary" />
            
            <div className="flex items-start gap-3">
              <img
                src={parentAvatar}
                alt={parentSender}
                className="w-9 h-9 rounded-xl object-cover border border-[var(--glass-border)] flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-accent-primary">
                      {parentSender}
                    </span>
                    {isParentAi && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30">
                        <Bot size={10} />
                        Pulse AI
                      </span>
                    )}
                    {activeThreadMessage.isEncrypted && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                        <Lock size={10} />
                        E2EE
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-theme-muted flex-shrink-0">
                    {new Date(activeThreadMessage.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Parent Content */}
                {activeThreadMessage.text && (
                  <div className="text-xs text-theme-main leading-relaxed break-words">
                    <FormattedMessageText
                      text={activeThreadMessage.decryptedText || activeThreadMessage.text}
                    />
                  </div>
                )}

                {activeThreadMessage.image && (
                  <div className="mt-2.5 rounded-xl overflow-hidden max-h-56 border border-[var(--glass-border)]">
                    <img
                      src={activeThreadMessage.image}
                      alt="Attachment"
                      className="w-full h-auto object-cover max-h-56"
                    />
                  </div>
                )}

                {activeThreadMessage.audio && (
                  <div className="mt-2.5">
                    <AudioMessagePlayer
                      audioUrl={activeThreadMessage.audio}
                      isMine={false}
                    />
                  </div>
                )}

                {activeThreadMessage.file && (
                  <a
                    href={activeThreadMessage.file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2.5 flex items-center gap-2 p-2 rounded-xl bg-[var(--glass-hover)] border border-[var(--glass-border)] hover:border-accent-primary/40 transition-colors text-xs"
                  >
                    <FileText size={16} className="text-accent-primary" />
                    <span className="truncate flex-1 text-theme-main font-medium">
                      {activeThreadMessage.file.name}
                    </span>
                    <Download size={14} className="text-theme-muted" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Thread Separator */}
          <div className="flex items-center gap-3 py-1">
            <div className="h-[1px] flex-1 bg-[var(--glass-border)]" />
            <span className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider">
              {threadReplies.length} {threadReplies.length === 1 ? "Reply" : "Replies"}
            </span>
            <div className="h-[1px] flex-1 bg-[var(--glass-border)]" />
          </div>

          {/* Replies Stream */}
          {isThreadLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-accent-primary">
              <Loader size={20} className="animate-spin" />
              <span className="text-xs text-theme-muted">Loading thread history...</span>
            </div>
          ) : threadReplies.length === 0 ? (
            <div className="text-center py-12 px-6 text-theme-muted">
              <div className="w-12 h-12 rounded-2xl bg-[var(--glass-hover)] border border-[var(--glass-border)] flex items-center justify-center mx-auto mb-2 text-accent-primary">
                <MessageSquare size={20} />
              </div>
              <p className="text-xs font-medium text-theme-main">No replies yet</p>
              <p className="text-[11px] text-theme-muted mt-0.5">
                Start the discussion in this thread below.
              </p>
            </div>
          ) : (
            threadReplies.map((reply) => {
              const replySender = reply.senderId?.username || "Pulse User";
              const isMe = (reply.senderId?._id || reply.senderId) === authUser?._id;
              const isReplyAi = reply.isAiResponse || replySender === "Pulse AI";
              const avatar =
                reply.senderId?.profilePic ||
                "https://api.dicebear.com/7.x/bottts/svg?seed=" + replySender;

              return (
                <div
                  key={reply._id}
                  className={`flex items-start gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                >
                  <img
                    src={avatar}
                    alt={replySender}
                    className="w-7 h-7 rounded-lg object-cover border border-[var(--glass-border)] flex-shrink-0 mt-1"
                  />

                  <div
                    className={`max-w-[82%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm ${
                      isMe
                        ? "bg-accent-primary text-white rounded-tr-sm"
                        : isReplyAi
                        ? "bg-gradient-to-br from-emerald-500/10 via-[var(--glass-surface)] to-teal-500/10 border border-emerald-500/30 text-theme-main rounded-tl-sm"
                        : "bg-[var(--glass-surface)] border border-[var(--glass-border)] text-theme-main rounded-tl-sm"
                    }`}
                  >
                    <div
                      className={`flex items-center gap-1.5 mb-1 ${
                        isMe ? "justify-end text-white/80" : "text-theme-muted"
                      }`}
                    >
                      <span
                        className={`font-semibold text-[11px] ${
                          isMe
                            ? "text-white"
                            : isReplyAi
                            ? "text-emerald-400 font-bold"
                            : "text-accent-primary"
                        }`}
                      >
                        {isMe ? "You" : replySender}
                      </span>

                      {isReplyAi && (
                        <span className="inline-flex items-center gap-0.5 px-1 rounded-full text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <Bot size={9} /> AI
                        </span>
                      )}

                      {reply.isEncrypted && (
                        <span
                          className={`inline-flex items-center gap-0.5 text-[9px] ${
                            isMe ? "text-emerald-200" : "text-emerald-400"
                          }`}
                        >
                          <Lock size={9} /> E2EE
                        </span>
                      )}

                      <span className="text-[10px] opacity-75">
                        {new Date(reply.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {reply.text && (
                      <div className="break-words">
                        <FormattedMessageText
                          text={reply.decryptedText || reply.text}
                        />
                      </div>
                    )}

                    {reply.image && (
                      <div className="mt-2 rounded-xl overflow-hidden max-h-48 border border-[var(--glass-border)]">
                        <img
                          src={reply.image}
                          alt="Attachment"
                          className="w-full h-auto object-cover max-h-48"
                        />
                      </div>
                    )}

                    {reply.audio && (
                      <div className="mt-2">
                        <AudioMessagePlayer audioUrl={reply.audio} isMine={isMe} />
                      </div>
                    )}

                    {reply.file && (
                      <a
                        href={reply.file.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`mt-2 flex items-center gap-2 p-2 rounded-xl border text-xs transition-colors ${
                          isMe
                            ? "bg-white/15 border-white/20 text-white"
                            : "bg-[var(--glass-hover)] border-[var(--glass-border)] text-theme-main"
                        }`}
                      >
                        <FileText size={14} />
                        <span className="truncate flex-1 font-medium">
                          {reply.file.name}
                        </span>
                        <Download size={12} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={repliesEndRef} />
        </div>

        {/* Thread Reply Composer */}
        <div className="p-3 border-t border-[var(--glass-border)] bg-[var(--glass-surface)]/90 backdrop-blur-xl flex-shrink-0">
          {/* Quick AI & Security Badges */}
          <div className="flex items-center justify-between mb-2 px-1">
            <button
              type="button"
              onClick={insertPulseMention}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
            >
              <Sparkles size={10} />
              Ask @pulse in thread
            </button>

            {isE2eeEnabled && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                <Lock size={10} />
                E2EE active
              </span>
            )}
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-2">
            <div className="flex-1 relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Reply to @${parentSender}...`}
                className="w-full bg-[var(--glass-hover)] border border-[var(--glass-border)] focus:border-accent-primary rounded-xl px-3.5 py-2.5 text-xs text-theme-main placeholder-theme-muted outline-none transition-all pr-8"
              />
            </div>

            <button
              type="submit"
              disabled={!replyText.trim() || isSending}
              className="p-2.5 rounded-xl bg-accent-primary text-white hover:bg-accent-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-accent-primary/25 transition-all flex items-center justify-center flex-shrink-0"
              title="Send reply"
            >
              {isSending ? (
                <Loader size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ThreadDrawer;
