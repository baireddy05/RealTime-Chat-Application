import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";

const MessageInfoModal = ({ message, onClose }) => {
  const [receipts, setReceipts] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!message?._id) return;
    const fetchReceipts = async () => {
      setIsLoading(true);
      try {
        const res = await axiosInstance.get(`/chat/message/${message._id}/receipts`);
        setReceipts(res.data);
      } catch (err) {
        console.error("Error fetching message receipts:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReceipts();
  }, [message?._id]);

  if (!message) return null;

  const displayText = message.decryptedText || message.text;
  const readers = receipts?.readBy || [];
  const senderName = message.senderId?.username || "You";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none overflow-y-auto"
    >
      <section
        onClick={(e) => e.stopPropagation()}
        className="relative overflow-hidden rounded-xl bg-surface-container-low/90 backdrop-blur-2xl p-space-lg shadow-2xl border border-outline/10 text-on-surface max-w-xl w-full animate-scaleIn my-8"
      >
        {/* Specular line */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-tertiary/40 to-transparent pointer-events-none" />

        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-sm mb-space-md border-b border-outline/10">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-tertiary text-xl">lock</span>
            <span className="font-headline-md text-headline-md text-on-surface font-semibold text-base sm:text-lg">
              E2EE Message Audit &amp; Receipts
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-space-sm py-0.5 rounded-full bg-tertiary/20 text-tertiary font-label-mono text-xs font-semibold">
              Verified Zero-Knowledge
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-surface-container-high hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* Inspected Message Snippet */}
        <div className="p-space-md rounded-xl bg-surface-container/60 mb-space-md flex flex-col gap-space-xs shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] border border-white/5">
          <div className="flex justify-between items-center text-outline font-label-mono text-xs">
            <span>Author: {senderName}</span>
            <span>Sent: {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          </div>

          <div className="p-space-sm rounded-lg bg-surface-container-high/80 text-on-surface font-body-md text-sm my-1 leading-relaxed">
            {displayText ? (
              displayText
            ) : message.image ? (
              <span className="text-secondary font-medium">📷 Image Attachment</span>
            ) : message.audio ? (
              <span className="text-secondary font-medium">🎤 Voice Note</span>
            ) : message.file ? (
              <span className="text-secondary font-medium">📎 {message.file.name}</span>
            ) : (
              <span className="text-outline italic">Encrypted payload</span>
            )}
          </div>

          <div className="flex items-center justify-between text-outline font-label-mono text-xs pt-space-xs">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-secondary">fingerprint</span>
              <span>SHA-256: {message._id?.slice(-8).toUpperCase()}...E2EE</span>
            </span>
            <span className="text-tertiary font-semibold">
              {readers.length > 0 ? `${readers.length} Confirmed Read` : "Delivered to Mesh"}
            </span>
          </div>
        </div>

        {/* Read Receipts Timeline Grid */}
        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-outline">
            <span className="material-symbols-outlined animate-spin text-tertiary text-2xl">sync</span>
            <span className="text-xs font-label-mono">Querying mesh receipts...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md mb-4">
              {/* Delivery Stage 1 */}
              <div className="p-space-sm rounded-xl bg-surface-container/40 flex items-center justify-between border border-white/5">
                <div className="flex items-center gap-space-sm">
                  <div className="w-8 h-8 rounded-full bg-secondary-container/20 text-secondary flex items-center justify-center font-bold text-sm">
                    ✓
                  </div>
                  <div>
                    <div className="font-title-sm text-xs font-semibold text-on-surface">Delivered to Edge Server</div>
                    <div className="font-label-mono text-[10px] text-outline">Pulse Relay Cluster</div>
                  </div>
                </div>
                <span className="font-label-mono text-xs text-secondary">
                  {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {/* Delivery Stage 2: Read Status */}
              <div className="p-space-sm rounded-xl bg-surface-container/40 flex items-center justify-between border border-white/5">
                <div className="flex items-center gap-space-sm">
                  <div className="w-8 h-8 rounded-full bg-tertiary-container/30 text-tertiary flex items-center justify-center font-bold text-sm">
                    ✓✓
                  </div>
                  <div>
                    <div className="font-title-sm text-xs font-semibold text-on-surface">Distributed Mesh Read</div>
                    <div className="font-label-mono text-[10px] text-tertiary">
                      {readers.length > 0 ? `${readers.length} peers decrypted` : "Awaiting recipient"}
                    </div>
                  </div>
                </div>
                <span className="font-label-mono text-xs text-tertiary">
                  {readers.length > 0 ? "Read" : "Sent"}
                </span>
              </div>
            </div>

            {/* List of confirmed readers */}
            {readers.length > 0 && (
              <div className="p-3 rounded-xl bg-surface-container/30 border border-white/5">
                <span className="font-label-caps text-[10px] uppercase text-outline font-bold tracking-wider block mb-2">
                  Confirmed Readers ({readers.length})
                </span>
                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                  {readers.map((user) => (
                    <div key={user._id || user} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2">
                        <img
                          src={user.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || "User")}&background=8083ff&color=ffffff`}
                          alt={user.username}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <span className="font-medium text-on-surface">{user.username || "Recipient"}</span>
                      </div>
                      <span className="text-secondary font-label-mono text-[11px]">Decrypted</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default MessageInfoModal;
