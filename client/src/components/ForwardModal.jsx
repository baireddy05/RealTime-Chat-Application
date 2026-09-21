import { useState } from "react";
import { X, Search, Send, Forward, Check } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useFriendStore } from "../store/useFriendStore";
import { useAuthStore } from "../store/useAuthStore";
import { isEncryptedMessage } from "../lib/crypto";

const ForwardModal = ({ message, messages, onClose }) => {
  const [search, setSearch] = useState("");
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [successText, setSuccessText] = useState("");

  const { rooms, forwardMessage, forwardMessages } = useChatStore();
  const { friends } = useFriendStore();
  const { authUser } = useAuthStore();

  // Single message (legacy prop) or a list (bulk select like WhatsApp)
  const messageList = Array.isArray(messages) && messages.length > 0
    ? messages
    : message
    ? [message]
    : [];
  const isBulk = messageList.length > 1;

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredFriends = friends.filter((f) =>
    f.username.toLowerCase().includes(search.toLowerCase())
  );

  // Saved Messages (self-chat) pinned at the top, like the sidebar
  const selfEntry = authUser?._id
    ? {
        id: authUser._id,
        type: "user",
        name: "Saved Messages",
        profilePic: authUser.profilePic,
      }
    : null;
  const showSelf =
    !!selfEntry &&
    (!search.trim() ||
      "saved messages".includes(search.trim().toLowerCase()) ||
      (authUser.username || "").toLowerCase().includes(search.trim().toLowerCase()));
  const isSelfSelected = !!selfEntry && selectedTarget?.id === selfEntry.id && selectedTarget?.type === "user";

  const handleForward = async () => {
    if (!selectedTarget || messageList.length === 0) return;

    setIsSending(true);
    const res = isBulk
      ? await forwardMessages({ messages: messageList, targetChat: selectedTarget })
      : await forwardMessage({
          message: messageList[0],
          targetChat: selectedTarget,
        });
    setIsSending(false);

    if (res.success) {
      const label = isBulk
        ? `Forwarded ${res.forwardedCount || messageList.length} messages to ${selectedTarget.name}!`
        : `Forwarded to ${selectedTarget.name}!`;
      setSuccessText(label);
      setTimeout(() => {
        onClose();
      }, 900);
    }
  };

  const firstMessage = messageList[0] || {};
  const previewSnippet = isBulk
    ? `${messageList.length} selected messages`
    : firstMessage.decryptedText ||
      (isEncryptedMessage(firstMessage.text) ? "🔒 Encrypted Message" : firstMessage.text) ||
      (firstMessage.image ? "Photo" : firstMessage.file ? firstMessage.file.name : firstMessage.audio ? "Voice memo" : "Message");

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
              <h3 className="font-semibold text-sm text-theme-main">{isBulk ? `Forward ${messageList.length} Messages` : "Forward Message"}</h3>
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
              placeholder="Search contacts or groups..."
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
              {/* Saved Messages (self-chat) */}
              {showSelf && (
                <div>
                  <span className="text-[10px] font-medium text-theme-muted uppercase tracking-wider block mb-1.5">
                    Yourself
                  </span>
                  <div
                    onClick={() => setSelectedTarget({ ...selfEntry })}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelfSelected
                        ? "bg-accent-primary/20 border border-accent-primary/40 text-theme-main font-medium"
                        : "hover:bg-[var(--glass-hover)] text-theme-main"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={
                          selfEntry.profilePic ||
                          `https://ui-avatars.com/api/?name=Saved&background=3b82f6&color=ffffff`
                        }
                        alt="Saved Messages"
                        className="w-7 h-7 rounded-full object-cover border border-[var(--glass-border)]"
                      />
                      <span className="text-xs font-medium truncate text-theme-main flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">bookmark</span>
                        Saved Messages (You)
                      </span>
                    </div>

                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                        isSelfSelected
                          ? "border-accent-primary bg-accent-primary text-white"
                          : "border-[var(--glass-border)]"
                      }`}
                    >
                      {isSelfSelected && <Check size={10} strokeWidth={3} />}
                    </div>
                  </div>
                </div>
              )}

              {/* Groups section */}
              {filteredRooms.length > 0 && (
                <div>
                  <span className="text-[10px] font-medium text-theme-muted uppercase tracking-wider block mb-1.5">
                    Groups ({filteredRooms.length})
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

              {!showSelf && filteredRooms.length === 0 && filteredFriends.length === 0 && (
                <div className="py-12 text-center text-xs text-theme-muted">
                  No contacts or groups found matching "{search}"
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
