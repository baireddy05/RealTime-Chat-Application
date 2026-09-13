import { useEffect, useState, useRef, useMemo } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useFriendStore } from "../store/useFriendStore";
import CreateGroupModal from "./CreateGroupModal";
import { isEncryptedMessage } from "../lib/crypto";

const formatTimeRelative = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  if (diffHours < 48) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const getMessageSnippet = (msg) => {
  if (!msg) return "";
  if (msg.audio) return "🎤 Voice note";
  if (msg.image) return "📷 Photo";
  if (msg.file) return `📎 ${msg.file.name || "Attachment"}`;
  
  const text = msg.decryptedText || msg.text || "";
  if (isEncryptedMessage(text)) {
    return "Message";
  }
  return text;
};

const Sidebar = ({
  onChatSelect,
  onOpenSetStatus,
  onOpenAddFriend,
  onOpenCreateGroup,
  onOpenStatus,
  onOpenStarred,
  onToggleTheme,
  theme,
  statusEmoji = "💻",
  statusCategory = "Coding",
  statusDetail = "Available",
  handleInstallPWA,
  logout,
  setIsWallpaperOpen,
}) => {
  const {
    rooms,
    getRooms,
    selectedChat,
    setSelectedChat,
    unreadCounts,
    lastMessages,
  } = useChatStore();

  const { authUser, onlineUsers } = useAuthStore();
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    searchResults,
    getFriends,
    getFriendRequests,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    subscribeToFriendEvents,
    unsubscribeFromFriendEvents,
  } = useFriendStore();

  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [isLocalCreateGroupOpen, setIsLocalCreateGroupOpen] = useState(false);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    getRooms();
    getFriends();
    getFriendRequests();
    subscribeToFriendEvents();
    return () => {
      unsubscribeFromFriendEvents();
    };
  }, [getRooms, getFriends, getFriendRequests, subscribeToFriendEvents, unsubscribeFromFriendEvents]);

  // Keyboard shortcut: Command+K or Ctrl+K focuses the search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAcceptRequest = async (requestId) => {
    setActionLoadingId(requestId);
    await acceptFriendRequest(requestId);
    setActionLoadingId(null);
  };

  const handleRejectRequest = async (requestId) => {
    setActionLoadingId(requestId);
    await rejectFriendRequest(requestId);
    setActionLoadingId(null);
  };

  const handleSendRequest = async (userId) => {
    setActionLoadingId(userId);
    await sendFriendRequest(userId);
    setActionLoadingId(null);
  };

  const selectChat = (chat) => {
    setSelectedChat(chat);
    onChatSelect?.();
  };

  // Search filter
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const timer = setTimeout(() => {
        searchUsers(searchQuery);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, searchUsers]);

  const pendingCount = incomingRequests?.length || 0;
  const onlineUsersSet = useMemo(() => new Set(onlineUsers || []), [onlineUsers]);

  // Clean WhatsApp groups: exclude Discord seed channels
  const filteredRooms = useMemo(() => {
    const nonDiscord = (rooms || []).filter((r) => {
      const name = (r.name || "").toLowerCase().trim();
      return (
        name !== "#announcements" &&
        name !== "announcements" &&
        name !== "#dev-hangout" &&
        name !== "dev-hangout"
      );
    });
    const q = searchQuery.toLowerCase().trim();
    if (!q) return nonDiscord;
    return nonDiscord.filter((r) => r.name.toLowerCase().includes(q));
  }, [rooms, searchQuery]);

  const filteredFriends = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return friends || [];
    return (friends || []).filter((f) => f.username.toLowerCase().includes(q));
  }, [friends, searchQuery]);

  // Compute Unread lists
  const unreadRooms = useMemo(() => {
    return filteredRooms.filter((r) => (unreadCounts[r._id] || 0) > 0);
  }, [filteredRooms, unreadCounts]);

  const unreadFriends = useMemo(() => {
    return filteredFriends.filter((f) => (unreadCounts[f._id] || 0) > 0);
  }, [filteredFriends, unreadCounts]);

  const totalUnreadCount = unreadRooms.length + unreadFriends.length;
  const roomsCount = filteredRooms.length;
  const directCount = filteredFriends.length;
  const allCount = roomsCount + directCount;

  const topPendingRequest = incomingRequests && incomingRequests.length > 0 ? incomingRequests[0] : null;

  const handleOpenGroupModal = () => {
    if (onOpenCreateGroup) {
      onOpenCreateGroup();
    } else {
      setIsLocalCreateGroupOpen(true);
    }
  };

  return (
    <section
      aria-label="Chats List"
      className="h-full flex flex-col p-3 text-on-surface select-none overflow-hidden transition-colors duration-200 bg-transparent"
    >
      {/* 1. Sleek Top WhatsApp Header Bar with Actions */}
      <div className="flex flex-col gap-2 pb-2">
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center cursor-pointer" onClick={() => setSelectedChat(null)}>
            <h1 className="font-bold tracking-tight text-white text-xl leading-tight">Chats</h1>
          </div>

          <div className="flex items-center gap-1">
            {/* WhatsApp 24-Hour Status Stories Button */}
            {onOpenStatus && (
              <button
                onClick={onOpenStatus}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Status Stories"
                type="button"
              >
                <span className="material-symbols-outlined text-lg">motion_photos_on</span>
              </button>
            )}

            {/* New Group Button */}
            <button
              onClick={handleOpenGroupModal}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="New Group"
              type="button"
            >
              <span className="material-symbols-outlined text-lg">group_add</span>
            </button>

            {/* Add Contact Button */}
            <button
              onClick={onOpenAddFriend}
              className="relative p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Add Contact"
              type="button"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              {pendingCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-white animate-pulse" />
              )}
            </button>

            {/* Options Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                title="More options"
                type="button"
              >
                <span className="material-symbols-outlined text-lg">more_vert</span>
              </button>

              {showOptionsDropdown && (
                <div className="absolute right-0 top-9 w-52 rounded-2xl bg-[#14131a]/95 backdrop-blur-2xl border border-white/10 p-1.5 shadow-2xl z-50 animate-scaleIn select-none text-white">
                  {onOpenStarred && (
                    <button
                      onClick={() => { onOpenStarred(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-200 hover:text-white hover:bg-white/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-sm">star</span>
                      <span>Starred Messages</span>
                    </button>
                  )}
                  {onOpenSetStatus && (
                    <button
                      onClick={() => { onOpenSetStatus(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-200 hover:text-white hover:bg-white/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-sm">sentiment_satisfied</span>
                      <span>Set Status Mood</span>
                    </button>
                  )}
                  {setIsWallpaperOpen && (
                    <button
                      onClick={() => { setIsWallpaperOpen(true); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-200 hover:text-white hover:bg-white/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-sm">wallpaper</span>
                      <span>Chat Wallpaper</span>
                    </button>
                  )}
                  {handleInstallPWA && (
                    <button
                      onClick={() => { handleInstallPWA(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-200 hover:text-white hover:bg-white/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-sm">install_desktop</span>
                      <span>Install Pulse PWA</span>
                    </button>
                  )}
                  {onToggleTheme && (
                    <button
                      onClick={() => { onToggleTheme(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-200 hover:text-white hover:bg-white/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {theme === "dark" ? "light_mode" : "dark_mode"}
                      </span>
                      <span>Switch Theme</span>
                    </button>
                  )}
                  {logout && (
                    <>
                      <div className="my-1 border-t border-white/10" />
                      <button
                        onClick={() => { logout(); setShowOptionsDropdown(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-red-400 hover:bg-red-500/20 transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-sm">logout</span>
                        <span>Sign Out</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Presence Status Mood Bar */}
        <div
          onClick={onOpenSetStatus}
          className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-all group"
          title="Click to change your presence status"
        >
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-xs">{statusEmoji}</span>
            <span className="text-xs text-zinc-400 truncate font-normal">
              <span className="text-white font-medium">{statusCategory}:</span> {statusDetail}
            </span>
          </div>
          <span className="material-symbols-outlined text-xs text-zinc-500 group-hover:text-white transition-colors">
            edit
          </span>
        </div>

        {/* Search Bar with ⌘K */}
        <div className="relative flex items-center w-full mt-1">
          <span className="material-symbols-outlined absolute left-3 text-zinc-500 pointer-events-none text-base">
            search
          </span>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-11 py-2 rounded-full glass-input text-white placeholder:text-zinc-500 text-xs focus:outline-none focus:ring-1 focus:ring-white/40 transition-all bg-white/5 border border-white/10"
            style={{ color: "#ffffff", caretColor: "#ffffff" }}
            placeholder="Search or start new chat (⌘K)..."
            type="text"
          />
          <kbd className="absolute right-3 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-400 font-mono text-[9px] pointer-events-none">
            ⌘K
          </kbd>
        </div>

        {/* WhatsApp-Standard Category Filter Tabs: All, Unread, Groups, Direct */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1.5">
          <button
            onClick={() => setActiveFilter("all")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === "all"
                ? "bg-white text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
            type="button"
          >
            <span>All</span>
            <span className="text-[10px] opacity-75 font-mono">({allCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter("unread")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === "unread"
                ? "bg-white text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
            type="button"
          >
            <span>Unread</span>
            {totalUnreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white text-black text-[9px] font-bold">
                {totalUnreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveFilter("groups")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === "groups"
                ? "bg-white text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
            type="button"
          >
            <span>Groups</span>
            <span className="text-[10px] opacity-75 font-mono">({roomsCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter("direct")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === "direct"
                ? "bg-white text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
            type="button"
          >
            <span>Direct</span>
            <span className="text-[10px] opacity-75 font-mono">({directCount})</span>
          </button>
        </div>
      </div>

      {/* 2. Top Pending Friend Request Banner */}
      {topPendingRequest && (
        <div className="my-1.5 p-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2 animate-fadeIn shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <img
              className="w-8 h-8 rounded-full object-cover shrink-0 border border-white/10"
              alt={topPendingRequest.sender?.username || "Contact"}
              src={
                topPendingRequest.sender?.profilePic ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  topPendingRequest.sender?.username || "U"
                )}&background=27272a&color=ffffff`
              }
            />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold truncate text-white">
                {topPendingRequest.sender?.username}
              </span>
              <span className="text-[10px] text-zinc-400 truncate">Wants to connect</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleAcceptRequest(topPendingRequest._id)}
              disabled={actionLoadingId === topPendingRequest._id}
              className="p-1 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              title="Accept"
            >
              <span className="material-symbols-outlined text-sm">check</span>
            </button>
            <button
              onClick={() => handleRejectRequest(topPendingRequest._id)}
              disabled={actionLoadingId === topPendingRequest._id}
              className="p-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              title="Decline"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Global User Search Results (When typing) */}
      {searchQuery.trim().length >= 2 && searchResults.length > 0 && (
        <div className="mb-2 p-2 rounded-2xl bg-[#14131a]/90 border border-white/10 flex flex-col gap-1 shrink-0 max-h-48 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-mono text-zinc-400 uppercase font-semibold px-1">
            Global Search
          </div>
          {searchResults.map((user) => {
            const isAlreadyFriend = friends.some((f) => f._id === user._id) || user.relationship === "friend";
            const isMe = user._id === authUser?._id;
            const isPendingOutgoing =
              user.relationship === "pending_outgoing" ||
              outgoingRequests?.some((r) => (r.receiver?._id || r.receiver) === user._id);
            const isPendingIncoming =
              user.relationship === "pending_incoming" ||
              incomingRequests?.some((r) => (r.sender?._id || r.sender) === user._id);
            const isLoading = actionLoadingId === user._id;

            return (
              <div
                key={user._id}
                onClick={() => {
                  selectChat({
                    id: user._id,
                    name: user.username,
                    type: "user",
                    avatar: user.profilePic,
                    status: user.status || "Available",
                    email: user.email,
                  });
                }}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={user.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || "User")}&background=27272a&color=ffffff`}
                    alt={user.username}
                    className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block truncate">{user.username}</span>
                    <span className="text-[10px] text-zinc-400 block truncate">{user.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                  {isMe ? (
                    <span className="text-[10px] text-zinc-500 font-mono px-2 py-0.5 rounded-full bg-white/5">You</span>
                  ) : isAlreadyFriend ? (
                    <button
                      type="button"
                      onClick={() => {
                        selectChat({
                          id: user._id,
                          name: user.username,
                          type: "user",
                          avatar: user.profilePic,
                          status: user.status || "Available",
                          email: user.email,
                        });
                      }}
                      className="px-2.5 py-1 rounded-full bg-white text-black text-[11px] font-bold shadow-sm hover:bg-zinc-200 transition-all active:scale-95 flex items-center gap-1"
                      title="Open conversation"
                    >
                      <span className="material-symbols-outlined text-xs">chat</span>
                      <span>Chat</span>
                    </button>
                  ) : isPendingOutgoing ? (
                    <div className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-zinc-300 text-[10px] font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-white">done</span>
                      <span>Sent</span>
                    </div>
                  ) : isPendingIncoming ? (
                    <button
                      type="button"
                      onClick={() => {
                        const req = incomingRequests.find((r) => (r.sender?._id || r.sender) === user._id);
                        if (req) handleAcceptRequest(req._id);
                      }}
                      disabled={isLoading}
                      className="px-2.5 py-1 rounded-full bg-white text-black text-[11px] font-bold shadow-sm hover:bg-zinc-200 transition-all active:scale-95 flex items-center gap-1"
                      title="Accept request"
                    >
                      <span className="material-symbols-outlined text-xs">check</span>
                      <span>Accept</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleSendRequest(user._id);
                      }}
                      disabled={isLoading}
                      className="px-3 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Send Contact Request"
                    >
                      {isLoading ? (
                        <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-xs">person_add</span>
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

      {/* 4. WhatsApp Conversation List */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-0.5 custom-scrollbar space-y-1">
        {/* Empty States */}
        {activeFilter === "unread" && totalUnreadCount === 0 && (
          <div className="p-8 text-center text-zinc-500 text-xs">No unread chats.</div>
        )}
        {activeFilter === "groups" && filteredRooms.length === 0 && (
          <div className="p-8 text-center text-zinc-500 text-xs">No groups found.</div>
        )}
        {activeFilter === "direct" && filteredFriends.length === 0 && (
          <div className="p-8 text-center text-zinc-500 text-xs">No direct contacts yet.</div>
        )}

        {/* Section Header: Groups */}
        {(activeFilter === "all" || activeFilter === "groups" || (activeFilter === "unread" && unreadRooms.length > 0)) &&
          (activeFilter === "unread" ? unreadRooms : filteredRooms).length > 0 && (
            <div className="pt-2 pb-1 px-2 flex items-center justify-between text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              <span>Groups</span>
              <span className="text-[9px] font-mono">
                {(activeFilter === "unread" ? unreadRooms : filteredRooms).length}
              </span>
            </div>
          )}

        {/* Groups List (WhatsApp Group Card Design) */}
        {(activeFilter === "all" || activeFilter === "groups" || activeFilter === "unread") &&
          (activeFilter === "unread" ? unreadRooms : filteredRooms).map((room) => {
            const isSelected = selectedChat?.id === room._id;
            const unread = unreadCounts[room._id] || 0;
            const lastMsg = lastMessages[room._id];
            const timeStr = lastMsg?.createdAt ? formatTimeRelative(lastMsg.createdAt) : "";
            const previewText = getMessageSnippet(lastMsg);
            const isOutgoing = lastMsg?.senderId === authUser?._id || lastMsg?.senderId?._id === authUser?._id;
            const senderUsername = isOutgoing
              ? "You"
              : lastMsg?.senderId?.username || "";

            return (
              <div
                key={room._id}
                onClick={() =>
                  selectChat({
                    id: room._id,
                    name: room.name,
                    type: "room",
                    description: room.description,
                    members: room.members,
                  })
                }
                className={`group relative flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? "bg-white text-[#0d0c11] shadow-lg border border-white font-semibold"
                    : "hover:bg-white/5 text-zinc-300 hover:text-white border border-transparent"
                }`}
              >
                {/* WhatsApp Group Icon (No hash #) */}
                <div className={`relative shrink-0 flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-150 ${
                  isSelected
                    ? "bg-[#0d0c11] text-white shadow-md font-bold scale-105"
                    : "bg-white/5 border border-white/10 text-zinc-400 group-hover:text-white group-hover:scale-105"
                }`}>
                  <span className="material-symbols-outlined text-xl">groups</span>
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs font-semibold truncate ${isSelected ? "text-[#0d0c11] font-bold" : "text-zinc-200 group-hover:text-white"}`}>
                      {room.name.replace(/^#/, "")}
                    </span>
                    <span className={`text-[10px] font-mono shrink-0 ${isSelected ? "text-zinc-600 font-medium" : "text-zinc-500"}`}>
                      {timeStr || "Active"}
                    </span>
                  </div>

                  <div className={`flex items-center gap-1 text-[11px] truncate mt-0.5 ${isSelected ? "text-zinc-600" : "text-zinc-400"}`}>
                    {previewText ? (
                      <>
                        {isOutgoing && (
                          <span className={`material-symbols-outlined text-[13px] shrink-0 ${isSelected ? "text-black" : "text-zinc-400"}`}>
                            done_all
                          </span>
                        )}
                        {senderUsername && (
                          <span className={`font-medium shrink-0 ${isSelected ? "text-black" : "text-zinc-300"}`}>
                            {senderUsername}:
                          </span>
                        )}
                        <span className="truncate">{previewText}</span>
                      </>
                    ) : (
                      <span className="truncate opacity-75">{room.description || "Group chat"}</span>
                    )}
                  </div>
                </div>

                {unread > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-black text-white text-[10px] font-bold shadow-sm animate-pulse">
                    {unread}
                  </span>
                )}
              </div>
            );
          })}

        {/* Section Header: Direct Chats */}
        {(activeFilter === "all" || activeFilter === "direct" || (activeFilter === "unread" && unreadFriends.length > 0)) &&
          (activeFilter === "unread" ? unreadFriends : filteredFriends).length > 0 && (
            <div className="pt-3 pb-1 px-2 flex items-center justify-between text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              <span>Direct Chats</span>
              <span className="text-[9px] font-mono">
                {(activeFilter === "unread" ? unreadFriends : filteredFriends).length}
              </span>
            </div>
          )}

        {/* Direct Contacts List */}
        {(activeFilter === "all" || activeFilter === "direct" || activeFilter === "unread") &&
          (activeFilter === "unread" ? unreadFriends : filteredFriends).map((friend) => {
            const isSelected = selectedChat?.id === friend._id;
            const isOnline = onlineUsersSet.has(friend._id);
            const unread = unreadCounts[friend._id] || 0;
            const lastMsg = lastMessages[friend._id];
            const timeStr = lastMsg?.createdAt ? formatTimeRelative(lastMsg.createdAt) : "";
            const previewText = getMessageSnippet(lastMsg);
            const isOutgoing = lastMsg?.senderId === authUser?._id || lastMsg?.senderId?._id === authUser?._id;

            return (
              <div
                key={friend._id}
                onClick={() =>
                  selectChat({
                    id: friend._id,
                    name: friend.username,
                    type: "user",
                    profilePic: friend.profilePic,
                  })
                }
                className={`group relative flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? "bg-white text-[#0d0c11] shadow-lg border border-white font-semibold"
                    : "hover:bg-white/5 text-zinc-300 hover:text-white border border-transparent"
                }`}
              >
                {/* Circular Avatar with Online Ring */}
                <div className="relative shrink-0 w-10 h-10 rounded-full overflow-hidden bg-white/5 border border-white/10">
                  <img
                    className="w-full h-full object-cover"
                    alt={friend.username}
                    src={
                      friend.profilePic ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        friend.username
                      )}&background=27272a&color=ffffff`
                    }
                  />
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#0e0d13] ${
                      isOnline
                        ? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.85)]"
                        : "bg-zinc-600"
                    }`}
                  />
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs font-semibold truncate ${isSelected ? "text-[#0d0c11] font-bold" : "text-zinc-200 group-hover:text-white"}`}>
                      {friend.username}
                    </span>
                    <span className={`text-[10px] font-mono shrink-0 ${isSelected ? "text-zinc-600 font-medium" : "text-zinc-500"}`}>
                      {timeStr || (isOnline ? "Online" : "")}
                    </span>
                  </div>

                  <div className={`flex items-center gap-1 text-[11px] truncate mt-0.5 ${isSelected ? "text-zinc-600" : "text-zinc-400"}`}>
                    {previewText ? (
                      <>
                        {isOutgoing && (
                          <span className={`material-symbols-outlined text-[13px] shrink-0 ${isSelected ? "text-black" : "text-zinc-400"}`}>
                            done_all
                          </span>
                        )}
                        <span className="truncate">{previewText}</span>
                      </>
                    ) : friend.status ? (
                      <span className="truncate">{friend.status}</span>
                    ) : (
                      <span className="truncate opacity-75">{isOnline ? "Available now" : "Offline"}</span>
                    )}
                  </div>
                </div>

                {unread > 0 ? (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm animate-pulse ${
                    isSelected ? "bg-black text-white" : "bg-white text-black"
                  }`}>
                    {unread}
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-xs text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    chat
                  </span>
                )}
              </div>
            );
          })}
      </div>

      {isLocalCreateGroupOpen && <CreateGroupModal onClose={() => setIsLocalCreateGroupOpen(false)} />}
    </section>
  );
};

export default Sidebar;
