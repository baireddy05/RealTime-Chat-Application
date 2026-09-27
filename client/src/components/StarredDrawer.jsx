import { useEffect } from "react";
import { X, Star, Loader, ExternalLink, Trash2, Paperclip } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

const formatStarredDate = (value) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return (
    d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
};

const StarredDrawer = ({ onClose, onJumpToMessage }) => {
  const {
    selectedChat,
    starredMessages,
    isStarredLoading,
    getStarredMessages,
    toggleStarMessage,
    jumpToMessage,
  } = useChatStore();

  useEffect(() => {
    if (selectedChat) {
      getStarredMessages(selectedChat.id, selectedChat.type);
    } else {
      getStarredMessages("all");
    }
  }, [selectedChat, getStarredMessages]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex justify-end animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm sm:max-w-md bg-[var(--glass-heavy)] backdrop-blur-2xl h-full sm:h-auto sm:max-h-[92dvh] sm:m-3 sm:rounded-3xl shadow-glass border-l sm:border border-[var(--glass-border)] flex flex-col animate-slideLeft text-theme-main overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-[var(--glass-divider)] flex items-center justify-between bg-[var(--glass-header)] flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-accent-primary/15 text-accent-primary border border-accent-primary/30 shrink-0">
              <Star size={16} className="fill-accent-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-theme-main leading-tight">Starred Messages</h3>
              <p className="text-[11px] text-theme-muted truncate">
                {selectedChat ? `${selectedChat.name} • ` : ""}{starredMessages.length} saved
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors shrink-0"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {isStarredLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-2 text-accent-primary">
              <Loader size={20} className="animate-spin" />
              <span className="text-xs text-theme-muted">Loading bookmarks...</span>
            </div>
          ) : starredMessages.length === 0 ? (
            <div className="text-center py-20 px-6">
              <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center mx-auto mb-3 text-accent-primary shadow-glass">
                <Star size={22} />
              </div>
              <p className="text-sm font-semibold text-theme-main">No Starred Messages</p>
              <p className="text-xs text-theme-muted mt-1 max-w-xs mx-auto leading-relaxed">
                Bookmark important messages, links, or attachments to easily find them here.
              </p>
              <p className="text-[11px] text-theme-muted mt-3 max-w-xs mx-auto leading-relaxed opacity-80">
                Tip: long-press or right-click any message, then tap <span className="font-semibold text-theme-main">Star</span>.
              </p>
            </div>
          ) : (
            starredMessages.map((msg) => {
              const sender = msg.senderId?.username || "User";
              const stamp = formatStarredDate(msg.createdAt);
              return (
                <div
                  key={msg._id}
                  className="bg-[var(--glass-panel)] rounded-2xl p-3.5 border border-[var(--glass-border)] shadow-sm hover:border-accent-primary/40 hover:shadow-glass transition-all group"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-accent-primary truncate">{sender}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {stamp && (
                        <span className="text-[10px] text-theme-muted">
                          {stamp}
                        </span>
                      )}
                      <button
                        onClick={() => toggleStarMessage(msg._id)}
                        className="p-1.5 text-theme-muted hover:text-red-400 hover:bg-[var(--glass-hover)] rounded-lg transition-colors"
                        title="Remove bookmark"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {msg.image && (
                    <img
                      src={msg.image}
                      alt="Starred attachment"
                      loading="lazy"
                      className="max-h-36 w-full rounded-xl object-cover mb-2 border border-[var(--glass-border)]"
                    />
                  )}

                  {msg.audio && (
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--glass-hover)] border border-[var(--glass-border)] mb-2 text-[11px] text-theme-muted">
                      🎤 Voice note
                    </div>
                  )}

                  {msg.file && (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--glass-hover)] border border-[var(--glass-border)] mb-2 min-w-0">
                      <Paperclip size={12} className="text-accent-primary shrink-0" />
                      <span className="text-xs text-theme-main font-medium truncate">
                        {msg.file.name || "Attachment"}
                      </span>
                    </div>
                  )}

                  {(msg.decryptedText || msg.text) && (
                    <p className="text-xs text-theme-main leading-relaxed break-words whitespace-pre-wrap">
                      {msg.decryptedText || msg.text}
                    </p>
                  )}

                  <div className="mt-3 pt-2 border-t border-[var(--glass-divider)] flex justify-end">
                    <button
                      onClick={() => {
                        if (onJumpToMessage) onJumpToMessage(msg);
                        else jumpToMessage(msg);
                        onClose();
                      }}
                      className="flex items-center gap-1 text-[11px] text-accent-primary hover:opacity-80 font-semibold transition-opacity"
                    >
                      <span>Go to message</span>
                      <ExternalLink size={11} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default StarredDrawer;
