import { useState } from "react";
import { X, Search, Send, Forward, Check } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useFriendStore } from "../store/useFriendStore";
import { isEncryptedMessage } from "../lib/crypto";

const ForwardModal = ({ message, onClose }) => {
  const [search, setSearch] = useState("");
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [successText, setSuccessText] = useState("");

  const { rooms, forwardMessage } = useChatStore();
  const { friends } = useFriendStore();

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredFriends = friends.filter((f) =>
    f.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleForward = async () => {
    if (!selectedTarget) return;

    setIsSending(true);
    const res = await forwardMessage({
      message,
      targetChat: selectedTarget,
    });
    setIsSending(false);

    if (res.success) {
      setSuccessText(`Forwarded to ${selectedTarget.name}!`);
      setTimeout(() => {
        onClose();
      }, 900);
    }
  };

  const previewSnippet =
    message.decryptedText ||
    (isEncryptedMessage(message.text) ? "🔒 Encrypted Message" : message.text) ||
    (message.image ? "Photo" : message.file ? message.file.name : message.audio ? "Voice memo" : "Message");

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl w-full max-w-md overflow-hidden shadow-glass animate-scaleIn text-theme-main flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-hover)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent-primary flex items-center justify-center text-white shadow-md shadow-accent-primary/25">
              <Forward size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-theme-main">Forward Message</h3>
              <p className="text-[11px] text-theme-muted truncate max-w-[220px]">
                "{previewSnippet.slice(0, 30)}{previewSnippet.length > 30 ? "..." : ""}"
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

        {/* Search */}
        <div className="p-3.5 border-b border-[var(--glass-border)]">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-theme-muted/50" />
            <input
              type="text"
              placeholder="Search contacts or channels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full glass-input rounded-xl pl-9 pr-3 py-1.5 text-xs text-theme-main placeholder-theme-muted/40 border border-[var(--glass-border)] focus:outline-none focus:border-accent-primary transition-all"
            />
          </div>
        </div>

        {/* Target List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {successText ? (
            <div className="py-12 flex flex-col items-center justify-center text-status-online gap-2 animate-fadeIn">
              <div className="w-10 h-10 rounded-full bg-status-online/20 flex items-center justify-center border border-status-online/40 text-status-online">
                <Check size={20} />
              </div>
              <span className="font-medium text-xs text-theme-main">{successText}</span>
            </div>
          ) : (
            <>
              {/* Channels section */}
              {filteredRooms.length > 0 && (
                <div>
                  <span className="text-[10px] font-medium text-theme-muted uppercase tracking-wider block mb-1.5">
                    Channels ({filteredRooms.length})
                  </span>
                  <div className="space-y-1">
                    {filteredRooms.map((room) => {
                      const isSelected =
                        selectedTarget?.id === room._id && selectedTarget?.type === "room";
                      const displayName = room.name.replace(/^#/, "");
                      return (
                        <div
                          key={room._id}
                          onClick={() =>
                            setSelectedTarget({ id: room._id, type: "room", name: room.name })
                          }
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-accent-primary/20 border border-accent-primary/40 text-theme-main font-medium"
                              : "hover:bg-[var(--glass-hover)] text-theme-main"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center font-medium text-xs flex-shrink-0">
                              {displayName.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs font-medium truncate capitalize">
                              {displayName}
                            </span>
                          </div>

                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                              isSelected
                                ? "border-accent-primary bg-accent-primary text-white"
                                : "border-[var(--glass-border)]"
                            }`}
                          >
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Friends section */}
              {filteredFriends.length > 0 && (
                <div>
                  <span className="text-[10px] font-medium text-theme-muted uppercase tracking-wider block mb-1.5">
                    Contacts ({filteredFriends.length})
                  </span>
                  <div className="space-y-1">
                    {filteredFriends.map((friend) => {
                      const isSelected =
                        selectedTarget?.id === friend._id && selectedTarget?.type === "user";
                      return (
                        <div
                          key={friend._id}
                          onClick={() =>
                            setSelectedTarget({
                              id: friend._id,
                              type: "user",
                              name: friend.username,
                            })
                          }
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-accent-primary/20 border border-accent-primary/40 text-theme-main font-medium"
                              : "hover:bg-[var(--glass-hover)] text-theme-main"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={
                                friend.profilePic ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username || "User")}&background=2563eb&color=ffffff`
                              }
                              alt={friend.username}
                              className="w-7 h-7 rounded-full object-cover border border-[var(--glass-border)]"
                            />
                            <span className="text-xs font-medium truncate text-theme-main">
                              {friend.username}
                            </span>
                          </div>

                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                              isSelected
                                ? "border-accent-primary bg-accent-primary text-white"
                                : "border-[var(--glass-border)]"
                            }`}
                          >
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredRooms.length === 0 && filteredFriends.length === 0 && (
                <div className="py-12 text-center text-xs text-theme-muted">
                  No contacts or channels found matching "{search}"
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[var(--glass-border)] bg-[var(--glass-hover)]">
          <span className="text-xs text-theme-muted">
            {selectedTarget ? (
              <span>
                To: <strong className="text-theme-main font-medium">{selectedTarget.name}</strong>
              </span>
            ) : (
              "Select a destination"
            )}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleForward}
              disabled={!selectedTarget || isSending || successText}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium text-white bg-accent-primary hover:bg-accent-primary/80 shadow-md shadow-accent-primary/25 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Send size={12} />
              <span>{isSending ? "Sending..." : "Forward"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
