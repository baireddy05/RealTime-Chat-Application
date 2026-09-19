import { useState, useEffect } from "react";
import { X, UserPlus, Search, Loader, Check, UserCheck, Inbox } from "lucide-react";
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
    incomingRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    getFriendRequests,
  } = useFriendStore();

  const { authUser } = useAuthStore();

  // Load all users and latest pending requests immediately on mount
  useEffect(() => {
    getFriendRequests();
    searchUsers("");
  }, [getFriendRequests, searchUsers]);

  // Debounced search when typing
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  const handleSendRequest = async (userId) => {
    setActionLoadingId(userId);
    await sendFriendRequest(userId);
    await searchUsers(searchQuery);
    setActionLoadingId(null);
  };

  const handleAccept = async (requestId) => {
    setActionLoadingId(requestId);
    await acceptFriendRequest(requestId);
    await searchUsers(searchQuery);
    setActionLoadingId(null);
  };

  const handleReject = async (requestId) => {
    setActionLoadingId(requestId);
    await rejectFriendRequest(requestId);
    await searchUsers(searchQuery);
    setActionLoadingId(null);
  };

  const pendingCount = incomingRequests?.length || 0;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white/95 dark:bg-[#121117]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleIn text-zinc-900 dark:text-white flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center font-bold shadow-md">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white tracking-tight">Add Contact</h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 flex-wrap">
                <span>Discover users & friend requests</span>
                {authUser?.username && (
                  <span className="text-zinc-700 dark:text-zinc-300 font-semibold bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 px-2 py-0.5 rounded-full text-[10px]">
                    Signed in as @{authUser.username}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-black/10 dark:border-white/10 shrink-0">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by username or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
          {/* 1. Pending Friend Requests Section (When available) */}
          {pendingCount > 0 && (
            <div className="p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 dark:border-white/20 backdrop-blur-xl shadow-glass flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Inbox size={15} className="text-zinc-900 dark:text-white" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-white tracking-wide">
                    Friend Requests ({pendingCount})
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Pending approval</span>
              </div>

              <div className="space-y-2">
                {incomingRequests.map((req) => {
                  const sender = req.sender || {};
                  const isLoading = actionLoadingId === req._id;

                  return (
                    <div
                      key={req._id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/[0.08] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={
                            sender.profilePic ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(sender.username || "User")}&background=27272a&color=ffffff&bold=true`
                          }
                          alt={sender.username}
                          className="w-9 h-9 rounded-full object-cover border border-black/10 dark:border-white/10 shadow-sm shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{sender.username}</p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{sender.status || "Wants to connect"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleAccept(req._id)}
                          disabled={isLoading}
                          className="px-3 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black font-bold text-xs hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1 shadow-sm cursor-pointer"
                        >
                          {isLoading ? <Loader size={12} className="animate-spin text-white dark:text-black" /> : <Check size={12} />}
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => handleReject(req._id)}
                          disabled={isLoading}
                          className="p-1.5 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                          title="Decline"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Registered Users / Search Results List */}
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {searchQuery.trim().length > 0
                  ? `Search Results (${searchResults.length})`
                  : `All Registered Users (${searchResults.length})`}
              </span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {searchQuery.trim().length > 0 ? "Filtered" : "Browse & Connect"}
              </span>
            </div>

            {isSearching ? (
              <div className="flex justify-center p-8">
                <Loader className="animate-spin text-zinc-900 dark:text-white size-6" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center mx-auto mb-3 text-zinc-400">
                  <UserPlus size={20} />
                </div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 font-semibold mb-1">No users found</p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  {searchQuery.trim().length > 0
                    ? `No registered user matches "${searchQuery}"`
                    : "No other registered users yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {searchResults.map((user) => {
                  const isSelf = user._id === authUser?._id || user.relationship === "self";
                  const isFriend = user.relationship === "friend";
                  const isPendingOut = user.relationship === "pending_outgoing";
                  const isPendingIn = user.relationship === "pending_incoming";

                  return (
                    <div
                      key={user._id}
                      className="flex items-center justify-between p-3 rounded-2xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-all bg-black/[0.02] dark:bg-white/[0.03]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={
                            user.profilePic ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || "User")}&background=27272a&color=ffffff&bold=true`
                          }
                          alt={user.username}
                          className="w-10 h-10 rounded-full object-cover border border-black/10 dark:border-white/10 shadow-sm shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{user.username}</p>
                            {isSelf && (
                              <span className="text-[10px] font-bold text-white bg-zinc-900 dark:text-black dark:bg-white px-1.5 py-0.2 rounded-full leading-tight">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                            {isSelf ? "Your active account" : (user.status || "Available")}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 ml-2">
                        {isSelf ? (
                          <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 px-3 py-1 rounded-full">
                            Current User
                          </span>
                        ) : isFriend ? (
                          <span className="text-[11px] font-bold text-white bg-zinc-900 dark:text-black dark:bg-white px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                            <UserCheck size={12} />
                            <span>Contact</span>
                          </span>
                        ) : isPendingOut ? (
                          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 px-3 py-1 rounded-full">
                            Sent
                          </span>
                        ) : isPendingIn ? (
                          <button
                            onClick={() => {
                              const matchingReq = incomingRequests.find(
                                (r) => (r.sender?._id || r.sender)?.toString() === user._id?.toString()
                              );
                              if (matchingReq) handleAccept(matchingReq._id);
                            }}
                            disabled={actionLoadingId === user._id}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black font-bold text-xs shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <Check size={12} />
                            <span>Accept</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSendRequest(user._id)}
                            disabled={actionLoadingId === user._id}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black font-bold text-xs shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            {actionLoadingId === user._id ? (
                              <Loader size={12} className="animate-spin text-white dark:text-black" />
                            ) : (
                              <UserPlus size={12} className="text-white dark:text-black" />
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
    </div>
  );
};

export default AddFriendModal;
