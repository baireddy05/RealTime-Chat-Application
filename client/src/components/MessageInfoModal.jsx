import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import { imageKind } from "../lib/attachments";
import MessageTicks from "./MessageTicks";

const MessageInfoModal = ({ message, onClose }) => {
  const [receipts, setReceipts] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const msgId = message?._id;
    if (!msgId) return;
    const ctrl = new AbortController();
    let active = true;
    const fetchReceipts = async () => {
      setIsLoading(true);
      try {
        const res = await axiosInstance.get(`/chat/message/${msgId}/receipts`, {
          signal: ctrl.signal,
        });
        if (!active) return;
        setReceipts(res.data);
      } catch (err) {
        if (!active) return;
        console.error("Error fetching message receipts:", err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchReceipts();
    return () => {
      active = false;
      try {
        ctrl.abort();
      } catch {}
    };
  }, [message?._id]);

  if (!message) return null;

  const displayText = message.decryptedText || message.text;
  const readers = receipts?.readBy || [];
  const senderName = message.senderId?.username || "You";
  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const formattedDate = new Date(message.createdAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none overflow-y-auto"
    >
      <section
        onClick={(e) => e.stopPropagation()}
        className="relative overflow-hidden rounded-3xl bg-white/95 dark:bg-[#121117]/95 backdrop-blur-3xl p-6 shadow-2xl border border-black/10 dark:border-white/10 text-zinc-900 dark:text-white max-w-md w-full animate-scaleIn my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center font-bold shadow-sm">
              <span className="material-symbols-outlined text-base">info</span>
            </div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-white tracking-tight">Message info</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Message Bubble Preview */}
        <div className="p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 mb-4 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs mb-1.5 font-medium">
            <span>{senderName}</span>
            <span className="font-mono text-[11px]">{formattedDate}, {formattedTime}</span>
          </div>

          <div className="text-sm text-zinc-900 dark:text-white leading-relaxed">
            {displayText ? (
              displayText
            ) : message.image ? (
              <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">image</span>
                <span>{imageKind(message) === "gif" ? "GIF" : imageKind(message) === "sticker" ? "Sticker" : "Photo"}</span>
              </span>
            ) : message.audio ? (
              <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">mic</span>
                <span>Voice message</span>
              </span>
            ) : message.file ? (
              <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">attach_file</span>
                <span>{message.file.name || "Attachment"}</span>
              </span>
            ) : (
              <span className="text-zinc-400 italic">Encrypted message</span>
            )}
          </div>
        </div>

        {/* Delivery & Read Receipts */}
        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-zinc-400">
            <span className="material-symbols-outlined animate-spin text-zinc-900 dark:text-white text-xl">sync</span>
            <span className="text-xs">Loading info...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Read Status */}
            <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center shadow-sm">
                  <MessageTicks status="read" size={15} animated={false} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-white">Read</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {readers.length > 0
                      ? `${readers.length} ${readers.length === 1 ? "person" : "people"}`
                      : "Not read yet"}
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                {readers.length > 0 ? formattedTime : "—"}
              </span>
            </div>

            {/* Delivered Status */}
            <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-black/5 text-zinc-700 dark:bg-white/10 dark:text-zinc-300 flex items-center justify-center border border-black/10 dark:border-white/10">
                  <MessageTicks status="delivered" size={15} animated={false} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-white">Delivered</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Delivered to recipient</div>
                </div>
              </div>
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                {formattedTime}
              </span>
            </div>

            {/* Read by List (for Group chats) */}
            {readers.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
                <span className="text-[10px] uppercase text-zinc-500 dark:text-zinc-400 font-bold tracking-wider block mb-2">
                  Read by ({readers.length})
                </span>
                <div className="flex flex-col gap-2 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                  {readers.map((user) => (
                    <div key={user._id || user} className="flex items-center justify-between text-xs py-1 border-b border-black/5 dark:border-white/5 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={
                            user.profilePic ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || "User")}&background=27272a&color=ffffff&bold=true`
                          }
                          alt={user.username}
                          className="w-7 h-7 rounded-full object-cover border border-black/10 dark:border-white/10"
                        />
                        <span className="font-semibold text-zinc-900 dark:text-white">{user.username || "Member"}</span>
                      </div>
                      <span className="text-zinc-500 dark:text-zinc-400 text-[11px] flex items-center gap-1 font-mono">
                        <MessageTicks status="read" size={12} animated={false} />
                        <span>Read</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default MessageInfoModal;
