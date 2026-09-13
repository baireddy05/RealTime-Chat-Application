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
  if (msg.image) return "📷 Photo attachment";
  if (msg.file) return `📎 ${msg.file.name || "Attachment"}`;
  
  const text = msg.decryptedText || msg.text || "";
  if (isEncryptedMessage(text)) {
    return "🔒 Encrypted Message";
  }
  return text;
};

const Sidebar = ({
  onChatSelect,
  onOpenSetStatus,
  onOpenAddFriend,
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
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
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

  const filteredRooms = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return rooms;
    return rooms.filter((r) => r.name.toLowerCase().includes(q));
  }, [rooms, searchQuery]);

  const filteredFriends = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return friends;
    return friends.filter((f) => f.username.toLowerCase().includes(q));
  }, [friends, searchQuery]);

  const roomsCount = filteredRooms.length;
  const directCount = filteredFriends.length;
  const allCount = roomsCount + directCount;

  const topPendingRequest = incomingRequests && incomingRequests.length > 0 ? incomingRequests[0] : null;

  return (
    <section
      aria-label="Chats List"
      className="h-full flex flex-col p-3 text-on-surface select-none overflow-hidden transition-colors duration-200 bg-transparent"
    >
      {/* 1. Sleek Top Workspace Bar with Actions */}
      <div className="flex flex-col gap-2 pb-2">
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSelectedChat(null)}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-accent-primary to-accent-secondary p-0.5 shadow-md flex items-center justify-center">
              <img alt="Pulse" className="w-5 h-5 object-contain" src="/logo.svg" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold tracking-tight text-on-surface text-base leading-tight">Pulse</span>
              <span className="text-[10px] font-mono text-outline leading-none">v2.4 E2EE</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* New Channel Button */}
            <button
              onClick={() => setIsCreateGroupOpen(true)}
              className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
              title="Create Channel"
              type="button"
            >
              <span className="material-symbols-outlined text-lg">add</span>
            </button>

            {/* Add Friend Button */}
            <button
              onClick={onOpenAddFriend}
              className="relative p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
              title="Add Contact"
              type="button"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              {pendingCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
              )}
            </button>

            {/* More Menu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
                className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
                title="Options"
                type="button"
              >
                <span className="material-symbols-outlined text-lg">more_vert</span>
              </button>

              {showOptionsDropdown && (
                <div className="absolute right-0 top-9 w-48 rounded-xl bg-surface-container-high/95 backdrop-blur-2xl border border-white/10 p-1.5 shadow-2xl z-50 animate-scaleIn select-none">
                  {onOpenSetStatus && (
                    <button
                      onClick={() => { onOpenSetStatus(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-on-surface hover:bg-surface-variant transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-sm text-secondary">sentiment_satisfied</span>
                      <span>Set Status Mood</span>
                    </button>
                  )}
                  {setIsWallpaperOpen && (
                    <button
                      onClick={() => { setIsWallpaperOpen(true); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-on-surface hover:bg-surface-variant transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-sm text-primary">wallpaper</span>
                      <span>Chat Wallpaper</span>
                    </button>
                  )}
                  {handleInstallPWA && (
                    <button
                      onClick={() => { handleInstallPWA(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-on-surface hover:bg-surface-variant transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-sm text-accent-secondary">install_desktop</span>
                      <span>Install Pulse PWA</span>
                    </button>
                  )}
                  {onToggleTheme && (
                    <button
                      onClick={() => { onToggleTheme(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-on-surface hover:bg-surface-variant transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {theme === "dark" ? "light_mode" : "dark_mode"}
                      </span>
                      <span>Switch Theme</span>
                    </button>
                  )}
                  {logout && (
                    <>
                      <div className="my-1 border-t border-outline/10" />
                      <button
                        onClick={() => { logout(); setShowOptionsDropdown(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-error hover:bg-error-container/30 transition-colors text-left"
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

        {/* Presence Status Mood Bar (Cleanly integrated in sidebar) */}
        <div
          onClick={onOpenSetStatus}
          className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 cursor-pointer transition-all group"
          title="Click to change your presence status"
        >
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-xs">{statusEmoji}</span>
            <span className="text-xs text-on-surface-variant truncate font-normal">
              <span className="text-on-surface font-medium">{statusCategory}:</span> {statusDetail}
            </span>
          </div>
          <span className="material-symbols-outlined text-xs text-outline group-hover:text-on-surface transition-colors">
            edit
          </span>
        </div>

        {/* Search Bar with ⌘K */}
        <div className="relative flex items-center w-full mt-1.5">
          <span className="material-symbols-outlined absolute left-3 text-outline pointer-events-none text-base">
            search
          </span>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-11 py-2 rounded-full glass-input text-on-surface placeholder:text-outline text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-inner"
            placeholder="Search conversations (⌘K)..."
            type="text"
          />
          <kbd className="absolute right-3 px-1.5 py-0.5 rounded-md bg-[var(--glass-surface)] border border-[var(--glass-border)] text-outline font-mono text-[9px] pointer-events-none">
            ⌘K
          </kbd>
        </div>

        {/* Category Filter Tabs */}
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
            onClick={() => setActiveFilter("channels")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === "channels"
                ? "bg-white text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
            type="button"
          >
            <span>Channels</span>
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

          <button
            onClick={() => setActiveFilter("requests")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === "requests"
                ? "bg-white text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
            type="button"
          >
            <span>Requests</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white text-black text-[9px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Top Pending Friend Request Banner */}
      {topPendingRequest && (
        <div className="my-1.5 p-2 rounded-xl bg-surface-container/90 border border-accent-primary/20 flex items-center justify-between gap-2 animate-fadeIn shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <img
              className="w-8 h-8 rounded-full object-cover shrink-0"
              alt={topPendingRequest.sender?.username || "Contact"}
              src={
                topPendingRequest.sender?.profilePic ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  topPendingRequest.sender?.username || "U"
                )}&background=8083ff&color=ffffff`
              }
            />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium truncate text-on-surface">
                {topPendingRequest.sender?.username}
              </span>
              <span className="text-[10px] text-outline truncate">Wants to connect</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleAcceptRequest(topPendingRequest._id)}
              disabled={actionLoadingId === topPendingRequest._id}
              className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
              title="Accept"
            >
              <span className="material-symbols-outlined text-sm">check</span>
            </button>
            <button
              onClick={() => handleRejectRequest(topPendingRequest._id)}
              disabled={actionLoadingId === topPendingRequest._id}
              className="p-1 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
              title="Decline"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Global User Search Results (When typing) */}
      {searchQuery.trim().length >= 2 && searchResults.length > 0 && (
        <div className="mb-2 p-2 rounded-xl bg-surface-container/80 border border-white/10 flex flex-col gap-1 shrink-0 max-h-48 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-mono text-secondary uppercase font-semibold px-1">
            Global Search
          </div>
          {searchResults.map((user) => {
            const isAlreadyFriend = friends.some((f) => f._id === user._id);
            const isMe = user._id === authUser?._id;
            return (
              <div
                key={user._id}
                className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={user.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || "User")}&background=8083ff&color=ffffff`}
                    alt={user.username}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-on-surface block truncate">{user.username}</span>
                    <span className="text-[10px] text-outline block truncate">{user.email}</span>
                  </div>
                </div>
                {!isMe && !isAlreadyFriend && (
                  <button
                    onClick={() => handleSendRequest(user._id)}
                    disabled={actionLoadingId === user._id}
                    className="p-1 rounded-lg bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30 transition-colors"
                    title="Send Friend Request"
                  >
                    <span className="material-symbols-outlined text-xs">person_add</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Conversation List (Clean, Smooth Virtual Scroll) */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-0.5 custom-scrollbar space-y-1">
        {/* Empty States */}
        {activeFilter === "channels" && filteredRooms.length === 0 && (
          <div className="p-8 text-center text-outline text-xs">No channels found.</div>
        )}
        {activeFilter === "direct" && filteredFriends.length === 0 && (
          <div className="p-8 text-center text-outline text-xs">No direct contacts yet.</div>
        )}

        {/* Section Header: Channels */}
        {(activeFilter === "all" || activeFilter === "channels") && filteredRooms.length > 0 && (
          <div className="pt-2 pb-1 px-2 flex items-center justify-between text-[10px] font-semibold text-outline uppercase tracking-wider">
            <span>Channels</span>
            <span className="text-[9px] font-mono">{filteredRooms.length}</span>
          </div>
        )}

        {/* Channels List */}
        {(activeFilter === "all" || activeFilter === "channels") &&
          filteredRooms.map((room) => {
            const isSelected = selectedChat?.id === room._id;
            const unread = unreadCounts[room._id] || 0;
            const lastMsg = lastMessages[room._id];
            const timeStr = lastMsg?.createdAt ? formatTimeRelative(lastMsg.createdAt) : "";
            const previewText = getMessageSnippet(lastMsg);
            const senderUsername = lastMsg?.senderId?.username || (lastMsg?.senderId === authUser?._id ? "You" : "");

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
                {/* Refined Channel Badge */}
                <div className={`relative shrink-0 flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150 ${
                  isSelected
                    ? "bg-[#0d0c11] text-white shadow-md font-bold scale-105"
                    : "bg-white/5 border border-white/10 text-zinc-400 group-hover:text-white group-hover:scale-105"
                }`}>
                  <span className="text-base font-bold">#</span>
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
                        {senderUsername && (
                          <span className={`font-medium shrink-0 ${isSelected ? "text-black" : "text-zinc-300"}`}>
                            {senderUsername}:
                          </span>
                        )}
                        <span className="truncate">{previewText}</span>
                      </>
                    ) : (
                      <span className="truncate opacity-75">{room.description || "General channel"}</span>
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

        {/* Section Header: Direct Messages */}
        {(activeFilter === "all" || activeFilter === "direct") && filteredFriends.length > 0 && (
          <div className="pt-3 pb-1 px-2 flex items-center justify-between text-[10px] font-semibold text-outline uppercase tracking-wider">
            <span>Direct Messages</span>
            <span className="text-[9px] font-mono">{filteredFriends.length}</span>
          </div>
        )}

        {/* Direct Contacts List */}
        {(activeFilter === "all" || activeFilter === "direct") &&
          filteredFriends.map((friend) => {
            const isSelected = selectedChat?.id === friend._id;
            const isOnline = onlineUsersSet.has(friend._id);
            const unread = unreadCounts[friend._id] || 0;
            const lastMsg = lastMessages[friend._id];
            const timeStr = lastMsg?.createdAt ? formatTimeRelative(lastMsg.createdAt) : "";
            const previewText = getMessageSnippet(lastMsg);

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
                {/* Circular Avatar with Glowing Online Indicator */}
                <div className="relative shrink-0 w-9 h-9 rounded-full overflow-hidden bg-white/5 border border-white/10">
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
                      <span className="truncate">{previewText}</span>
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

        {/* Requests Filter Tab Content */}
        {activeFilter === "requests" && (
          <div className="flex flex-col gap-1.5 pt-2">
            {incomingRequests.length === 0 ? (
              <div className="p-8 text-center text-outline text-xs">No pending requests.</div>
            ) : (
              incomingRequests.map((req) => (
                <div
                  key={req._id}
                  className="p-2.5 rounded-xl bg-surface-container/70 border border-white/5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={
                        req.sender?.profilePic ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(req.sender?.username || "U")}&background=8083ff&color=ffffff`
                      }
                      alt={req.sender?.username}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-on-surface block truncate">
                        {req.sender?.username}
                      </span>
                      <span className="text-[10px] text-outline block truncate">Connection request</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleAcceptRequest(req._id)}
                      disabled={actionLoadingId === req._id}
                      className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                      title="Accept"
                    >
                      <span className="material-symbols-outlined text-sm">check</span>
                    </button>
                    <button
                      onClick={() => handleRejectRequest(req._id)}
                      disabled={actionLoadingId === req._id}
                      className="p-1 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
                      title="Decline"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {isCreateGroupOpen && <CreateGroupModal onClose={() => setIsCreateGroupOpen(false)} />}
    </section>
  );
};

export default Sidebar;
