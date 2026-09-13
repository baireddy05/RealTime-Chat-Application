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
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-2xl flex items-center justify-center p-4 animate-fadeIn select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#121117]/95 backdrop-blur-3xl border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleIn text-white flex flex-col max-h-[82vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.03] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white text-black flex items-center justify-center font-bold shadow-md">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white tracking-tight">Add Contact</h3>
              <p className="text-[11px] text-zinc-400">Search by username to connect</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-white/10 shrink-0">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search username or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 text-zinc-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {isSearching ? (
            <div className="flex justify-center p-10">
              <Loader className="animate-spin text-white size-6" />
            </div>
          ) : searchQuery.trim().length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-zinc-400">
                <Search size={20} />
              </div>
              <p className="text-xs text-zinc-400 font-medium">Type a username to start searching</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-zinc-500">
                <UserPlus size={20} />
              </div>
              <p className="text-xs text-zinc-300 font-semibold mb-1">No users found</p>
              <p className="text-[11px] text-zinc-500">Could not find a user with username "{searchQuery}"</p>
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
                  <div
                    key={user._id}
                    className="flex items-center justify-between p-3 rounded-2xl border border-white/10 hover:bg-white/5 transition-all bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={
                          user.profilePic ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || "User")}&background=27272a&color=ffffff&bold=true`
                        }
                        alt={user.username}
                        className="w-10 h-10 rounded-full object-cover border border-white/10 shadow-sm"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{user.username}</p>
                        <p className="text-[10px] text-zinc-400 truncate">{user.status || "Available"}</p>
                      </div>
                    </div>
                    <div>
                      {isFriend ? (
                        <span className="text-[11px] font-bold text-black bg-white px-3 py-1 rounded-full shadow-sm">
                          Contact
                        </span>
                      ) : isPendingOut ? (
                        <span className="text-[11px] font-medium text-zinc-400 bg-white/10 border border-white/10 px-3 py-1 rounded-full">
                          Sent
                        </span>
                      ) : isPendingIn ? (
                        <span className="text-[11px] font-medium text-zinc-200 bg-white/20 border border-white/20 px-3 py-1 rounded-full">
                          Requested
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSendRequest(user._id)}
                          disabled={actionLoadingId === user._id}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-black font-bold text-xs shadow-sm hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {actionLoadingId === user._id ? (
                            <Loader size={12} className="animate-spin text-black" />
                          ) : (
                            <UserPlus size={12} className="text-black" />
                          )}
                          <span>Add</span>
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
