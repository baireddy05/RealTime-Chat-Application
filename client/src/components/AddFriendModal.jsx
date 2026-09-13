import { useState, useEffect } from "react";
import { X, UserPlus, Search, Loader } from "lucide-react";
import { useFriendStore } from "../store/useFriendStore";
import { useAuthStore } from "../store/useAuthStore";

const AddFriendModal = ({ onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const {
    searchResults,
    isSearching,
    searchUsers,
    sendFriendRequest,
  } = useFriendStore();

  const { authUser } = useAuthStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        searchUsers(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  const handleSendRequest = async (userId) => {
    setActionLoadingId(userId);
    await sendFriendRequest(userId);
    setActionLoadingId(null);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl w-full max-w-md overflow-hidden shadow-glass animate-scaleIn text-theme-main flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-hover)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent-primary flex items-center justify-center text-white shadow-md shadow-accent-primary/25">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-theme-main">Add Friend</h3>
              <p className="text-[11px] text-theme-muted">Search by username to connect</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 border-b border-[var(--glass-border)] shrink-0">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-theme-muted/50" />
            <input
              type="text"
              placeholder="Search username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full glass-input rounded-2xl pl-9 pr-8 py-2 text-xs text-theme-main placeholder-theme-muted/40 border border-[var(--glass-border)] focus:outline-none focus:border-accent-primary transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 text-theme-muted/60 hover:text-theme-main">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-[var(--glass-surface)]">
          {isSearching ? (
            <div className="flex justify-center p-10"><Loader className="animate-spin text-accent-primary size-6" /></div>
          ) : searchQuery.trim().length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-[var(--glass-hover)] border border-[var(--glass-border)] flex items-center justify-center mx-auto mb-3">
                <Search size={20} className="text-theme-muted/50" />
              </div>
              <p className="text-[12px] text-theme-muted/60 font-medium">Type a username to start searching</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-[var(--glass-hover)] border border-[var(--glass-border)] flex items-center justify-center mx-auto mb-3">
                <UserPlus size={20} className="text-theme-muted/30" />
              </div>
              <p className="text-[12px] text-theme-muted/80 font-medium mb-1">No users found</p>
              <p className="text-[11px] text-theme-muted/50">Could not find a user with username "{searchQuery}"</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {searchResults.map((user) => {
                const isFriend = user.relationship === "friend";
                const isPendingOut = user.relationship === "pending_outgoing";
                const isPendingIn = user.relationship === "pending_incoming";
                const isSelf = user._id === authUser._id;
                if (isSelf) return null;

                return (
                  <div key={user._id} className="flex items-center justify-between p-3 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--glass-hover)] transition-all bg-[var(--glass-heavy)]">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={user.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || "User")}&background=8083ff&color=ffffff`}
                        alt={user.username} className="w-10 h-10 rounded-full object-cover border border-[var(--glass-border)] shadow-sm" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-theme-main truncate">{user.username}</p>
                        <p className="text-[11px] text-theme-muted truncate">{user.status || "Available"}</p>
                      </div>
                    </div>
                    <div>
                      {isFriend ? (
                        <span className="text-[11px] font-medium text-status-online bg-status-online/15 px-3 py-1.5 rounded-xl border border-status-online/20">Friend</span>
                      ) : isPendingOut ? (
                        <span className="text-[11px] font-medium text-accent-secondary bg-accent-secondary/15 border border-accent-secondary/30 px-3 py-1.5 rounded-xl">Sent Request</span>
                      ) : isPendingIn ? (
                        <span className="text-[11px] font-medium text-accent-primary bg-accent-primary/15 border border-accent-primary/20 px-3 py-1.5 rounded-xl">Requested</span>
                      ) : (
                        <button onClick={() => handleSendRequest(user._id)} disabled={actionLoadingId === user._id}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent-primary hover:bg-accent-primary/85 text-white font-medium text-[12px] shadow-sm shadow-accent-primary/20 transition-all active:scale-[0.97] disabled:opacity-50 cursor-pointer">
                          {actionLoadingId === user._id ? <Loader size={12} className="animate-spin text-white" /> : <UserPlus size={12} className="text-white" />}
                          <span className="text-white font-medium">Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddFriendModal;
