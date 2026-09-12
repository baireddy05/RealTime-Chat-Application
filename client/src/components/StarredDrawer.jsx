import { useEffect } from "react";
import { X, Star, Loader, ExternalLink, Trash2 } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

const StarredDrawer = ({ onClose, onJumpToMessage }) => {
  const {
    selectedChat,
    starredMessages,
    isStarredLoading,
    getStarredMessages,
    toggleStarMessage,
  } = useChatStore();

  useEffect(() => {
    if (selectedChat) {
      getStarredMessages(selectedChat.id, selectedChat.type);
    }
  }, [selectedChat, getStarredMessages]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex justify-end animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm sm:max-w-md bg-[var(--glass-heavy)] backdrop-blur-2xl h-full shadow-glass border-l border-[var(--glass-border)] flex flex-col animate-slideLeft text-theme-main"
      >
        {/* Header */}
        <div className="h-16 px-5 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--glass-hover)] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-400/20 text-amber-500 border border-amber-400/30">
              <Star size={16} className="fill-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-theme-main">Starred Messages</h3>
              <p className="text-[11px] text-theme-muted">
                {starredMessages.length} saved
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isStarredLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-2 text-accent-primary">
              <Loader size={20} className="animate-spin" />
              <span className="text-xs text-theme-muted">Loading bookmarks...</span>
            </div>
          ) : starredMessages.length === 0 ? (
            <div className="text-center py-20 px-6 text-theme-muted">
              <div className="w-12 h-12 rounded-2xl bg-[var(--glass-hover)] border border-[var(--glass-border)] flex items-center justify-center mx-auto mb-3 text-amber-400">
                <Star size={20} />
              </div>
              <p className="text-sm font-medium text-theme-main">No Starred Messages</p>
              <p className="text-xs text-theme-muted mt-1 max-w-xs mx-auto">
                Bookmark important messages, links, or attachments to easily find them here.
              </p>
            </div>
          ) : (
            starredMessages.map((msg) => {
              const sender = msg.senderId?.username || "User";
              return (
                <div
                  key={msg._id}
                  className="bg-[var(--glass-surface)] rounded-2xl p-3.5 border border-[var(--glass-border)] shadow-sm hover:border-amber-400/40 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-accent-primary">{sender}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-theme-muted">
                        {new Date(msg.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <button
                        onClick={() => toggleStarMessage(msg._id)}
                        className="p-1 text-theme-muted hover:text-red-400 hover:bg-[var(--glass-hover)] rounded-lg transition-colors"
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
                      className="max-h-36 rounded-xl object-cover mb-2 border border-[var(--glass-border)]"
                    />
                  )}

                  {msg.file && (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--glass-hover)] border border-[var(--glass-border)] mb-2">
                      <span className="text-xs text-accent-primary font-medium truncate">
                        📎 {msg.file.name}
                      </span>
                    </div>
                  )}

                  {msg.text && (
                    <p className="text-xs text-theme-main leading-relaxed break-words whitespace-pre-wrap">
                      {msg.text}
                    </p>
                  )}

                  <div className="mt-3 pt-2 border-t border-[var(--glass-border)] flex justify-end">
                    <button
                      onClick={() => {
                        onJumpToMessage?.(msg._id);
                        onClose();
                      }}
                      className="flex items-center gap-1 text-[11px] text-accent-primary hover:underline font-medium"
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
