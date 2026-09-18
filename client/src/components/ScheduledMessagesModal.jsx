import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { X, Clock, Trash2, Calendar, Loader } from "lucide-react";
import { isEncryptedMessage } from "../lib/crypto";

const ScheduledMessagesModal = ({ isOpen, onClose }) => {
  const { selectedChat, scheduledMessages, getScheduledMessages, cancelScheduledMessage } = useChatStore();
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    if (isOpen && selectedChat) {
      queueMicrotask(() => setLoading(true));
      getScheduledMessages(selectedChat.id, selectedChat.type).finally(() => setLoading(false));
    }
  }, [isOpen, selectedChat, getScheduledMessages]);

  if (!isOpen) return null;

  const handleCancel = async (id) => {
    setCancellingId(id);
    await cancelScheduledMessage(id);
    setCancellingId(null);
  };

  const formatScheduledTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--glass-heavy)] border border-[var(--glass-border)] rounded-3xl shadow-glass overflow-hidden flex flex-col max-h-[80vh] animate-scaleIn smooth-gpu"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--glass-border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
              <Clock size={17} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-theme-main">Scheduled Messages</h3>
              <p className="text-[11px] text-theme-muted">
                {selectedChat ? `Pending for ${selectedChat.name}` : "Pending messages"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--glass-hover)] text-theme-muted hover:text-theme-main transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 min-h-[160px]">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-theme-muted gap-2">
              <Loader size={18} className="animate-spin text-accent-primary" />
              <span className="text-[13px]">Loading scheduled messages...</span>
            </div>
          ) : scheduledMessages.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Calendar size={32} className="mx-auto mb-2.5 text-theme-muted/40" />
              <p className="text-[13px] font-medium text-theme-main">No scheduled messages</p>
              <p className="text-[11px] text-theme-muted mt-0.5">
                Use the clock icon next to the send button to schedule a message for later.
              </p>
            </div>
          ) : (
            scheduledMessages.map((msg) => (
              <div
                key={msg._id}
                className="p-3.5 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] flex items-start justify-between gap-3 group hover:border-accent-primary/40 transition-all"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-accent-primary font-medium mb-1">
                    <Clock size={12} />
                    <span>Sends {formatScheduledTime(msg.scheduledFor)}</span>
                  </div>
                  <p className="text-[13px] text-theme-main break-words">
                    {(msg.decryptedText || (isEncryptedMessage(msg.text) ? "🔒 Encrypted Message" : msg.text)) || (msg.image ? "📷 Photo" : msg.file ? `📎 ${msg.file.name}` : "Attachment")}
                  </p>
                </div>
                <button
                  onClick={() => handleCancel(msg._id)}
                  disabled={cancellingId === msg._id}
                  className="p-2 rounded-xl text-theme-muted/70 hover:text-red-400 hover:bg-red-500/15 transition-all flex-shrink-0"
                  title="Cancel scheduled send"
                >
                  {cancellingId === msg._id ? (
                    <Loader size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--glass-border)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-accent-primary text-white text-[12px] font-medium hover:bg-accent-primary/90 transition-all shadow"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduledMessagesModal;
