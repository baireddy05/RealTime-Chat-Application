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
  onOpenProfile,
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

  const { authUser, onlineUsers, socket } = useAuthStore();
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
  }, [getRooms, getFriends, getFriendRequests, subscribeToFriendEvents, unsubscribeFromFriendEvents, socket]);

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

  // Sort helper by recent message
  const getChatTimestamp = (item) => {
    const lastMsg = lastMessages[item._id] || item.lastMessage;
    if (lastMsg?.createdAt) {
      const time = new Date(lastMsg.createdAt).getTime();
      if (!isNaN(time) && time > 0) return time;
    }
    if (item.updatedAt) {
      const time = new Date(item.updatedAt).getTime();
      if (!isNaN(time) && time > 0) return time;
    }
    if (item.createdAt) {
      const time = new Date(item.createdAt).getTime();
      if (!isNaN(time) && time > 0) return time;
    }
    return 0;
  };

  // Sorted lists by recent activity
  const sortedRooms = useMemo(() => {
    return [...filteredRooms].sort((a, b) => getChatTimestamp(b) - getChatTimestamp(a));
  }, [filteredRooms, lastMessages]);

  const sortedFriends = useMemo(() => {
    return [...filteredFriends].sort((a, b) => getChatTimestamp(b) - getChatTimestamp(a));
  }, [filteredFriends, lastMessages]);

  // Unified all chats stream (Groups + Direct combined, sorted by recent messages)
  const allChats = useMemo(() => {
    const roomItems = filteredRooms.map((r) => ({ ...r, chatType: "room" }));
    const friendItems = filteredFriends.map((f) => ({ ...f, chatType: "user" }));
    return [...roomItems, ...friendItems].sort((a, b) => getChatTimestamp(b) - getChatTimestamp(a));
  }, [filteredRooms, filteredFriends, lastMessages]);

  // Compute Unread lists
  const unreadChats = useMemo(() => {
    return allChats.filter((c) => (unreadCounts[c._id] || 0) > 0);
  }, [allChats, unreadCounts]);

  const totalUnreadCount = unreadChats.length;
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

  const renderRoomCard = (room) => {
    const roomId = (room._id || room.id)?.toString();
    const isSelected = (selectedChat?.id || selectedChat?._id)?.toString() === roomId;
    const unread = unreadCounts[roomId] || room.unreadCount || 0;
    const lastMsg = lastMessages[roomId] || room.lastMessage;
    const timeStr = lastMsg?.createdAt ? formatTimeRelative(lastMsg.createdAt) : "";
    const previewText = getMessageSnippet(lastMsg);
    const authUserId = authUser?._id?.toString();
    const msgSenderId = (lastMsg?.senderId?._id || lastMsg?.senderId)?.toString();
    const isOutgoing = msgSenderId === authUserId;
    const senderUsername = isOutgoing ? "You" : lastMsg?.senderId?.username || "";

    return (
      <div
        key={`room-${roomId}`}
        onClick={() =>
          selectChat({
            id: roomId,
            name: room.name,
            type: "room",
            description: room.description,
            members: room.members,
          })
        }
        className={`group relative flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all duration-150 ${
          isSelected
            ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-lg font-semibold border border-transparent"
            : "hover:bg-black/5 text-zinc-800 hover:text-zinc-950 dark:hover:bg-white/5 dark:text-zinc-300 dark:hover:text-white border border-transparent"
        }`}
      >
        <div
          className={`relative shrink-0 flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-150 ${
            isSelected
              ? "bg-white text-zinc-900 dark:bg-[#0d0c11] dark:text-white shadow-md font-bold scale-105"
              : "bg-black/5 border border-black/10 text-zinc-600 group-hover:text-zinc-900 group-hover:scale-105 dark:bg-white/5 dark:border-white/10 dark:text-zinc-400 dark:group-hover:text-white"
          }`}
        >
          <span className="material-symbols-outlined text-xl">groups</span>
        </div>

        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex flex-col">
            <span
              className={`text-xs font-semibold truncate ${
                isSelected ? "text-white dark:text-[#0d0c11] font-bold" : "text-zinc-900 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white"
              }`}
            >
              {room.name.replace(/^#/, "")}
            </span>

            <div className={`flex items-center gap-1 text-[11px] truncate mt-0.5 ${isSelected ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400"}`}>
              {previewText ? (
                <>
                  {isOutgoing && (
                    <span className={`material-symbols-outlined text-[13px] shrink-0 ${isSelected ? "text-white dark:text-black" : "text-zinc-400"}`}>
                      done_all
                    </span>
                  )}
                  {senderUsername && (
                    <span className={`font-medium shrink-0 ${isSelected ? "text-white dark:text-black" : "text-zinc-700 dark:text-zinc-300"}`}>
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

          <div className="shrink-0 flex flex-col items-end justify-center self-stretch gap-1 text-right">
            <span className={`text-[10px] font-mono leading-none ${isSelected ? "text-zinc-300 dark:text-zinc-600 font-medium" : "text-zinc-400 dark:text-zinc-500"}`}>
              {timeStr || "Active"}
            </span>
            {unread > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow-sm animate-pulse ${
                  isSelected ? "bg-white text-zinc-900 dark:bg-black dark:text-white" : "bg-zinc-900 text-white dark:bg-white dark:text-black"
                }`}
              >
                {unread}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFriendCard = (friend) => {
    const friendId = (friend._id || friend.id)?.toString();
    const isSelected = (selectedChat?.id || selectedChat?._id)?.toString() === friendId;
    const isOnline = onlineUsersSet.has(friendId);
    const unread = unreadCounts[friendId] || friend.unreadCount || 0;
    const lastMsg = lastMessages[friendId] || friend.lastMessage;
    const timeStr = lastMsg?.createdAt ? formatTimeRelative(lastMsg.createdAt) : "";
    const previewText = getMessageSnippet(lastMsg);
    const authUserId = authUser?._id?.toString();
    const msgSenderId = (lastMsg?.senderId?._id || lastMsg?.senderId)?.toString();
    const isOutgoing = msgSenderId === authUserId;

    return (
      <div
        key={`friend-${friendId}`}
        onClick={() =>
          selectChat({
            id: friendId,
            name: friend.username,
            type: "user",
            profilePic: friend.profilePic,
          })
        }
        className={`group relative flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all duration-150 ${
          isSelected
            ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-lg font-semibold border border-transparent"
            : "hover:bg-black/5 text-zinc-800 hover:text-zinc-950 dark:hover:bg-white/5 dark:text-zinc-300 dark:hover:text-white border border-transparent"
        }`}
      >
        <div className="relative shrink-0 w-10 h-10 rounded-full overflow-hidden bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
          <img
            className="w-full h-full object-cover"
            alt={friend.username}
            src={
              friend.profilePic ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username)}&background=27272a&color=ffffff`
            }
          />
          <span
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#0e0d13] ${
              isOnline
                ? "bg-emerald-500 dark:bg-white shadow-[0_0_6px_rgba(16,185,129,0.5)] dark:shadow-[0_0_6px_rgba(255,255,255,0.85)]"
                : "bg-zinc-400 dark:bg-zinc-600"
            }`}
          />
        </div>

        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex flex-col">
            <span
              className={`text-xs font-semibold truncate ${
                isSelected ? "text-white dark:text-[#0d0c11] font-bold" : "text-zinc-900 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white"
              }`}
            >
              {friend.username}
            </span>

            <div className={`flex items-center gap-1 text-[11px] truncate mt-0.5 ${isSelected ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400"}`}>
              {previewText ? (
                <>
                  {isOutgoing && (
                    <span className={`material-symbols-outlined text-[13px] shrink-0 ${isSelected ? "text-white dark:text-black" : "text-zinc-400"}`}>
                      done_all
                    </span>
                  )}
                  <span className="truncate">{previewText}</span>
                </>
              ) : (
                <span className="truncate opacity-75">{isOnline ? "Online" : "Offline"}</span>
              )}
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-end justify-center self-stretch gap-1 text-right">
            <span className={`text-[10px] font-mono leading-none ${isSelected ? "text-zinc-300 dark:text-zinc-600 font-medium" : "text-zinc-400 dark:text-zinc-500"}`}>
              {timeStr || (isOnline ? "Online" : "")}
            </span>
            {unread > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow-sm animate-pulse ${
                  isSelected ? "bg-white text-zinc-900 dark:bg-black dark:text-white" : "bg-zinc-900 text-white dark:bg-white dark:text-black"
                }`}
              >
                {unread}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderChatCard = (item) => {
    if (item.chatType === "room") {
      return renderRoomCard(item);
    }
    return renderFriendCard(item);
  };

  return (
    <section
      aria-label="Chats List"
      className="h-full flex flex-col p-3 text-on-surface select-none overflow-hidden transition-colors duration-200 bg-transparent"
    >
      {/* 1. Sleek Top WhatsApp Header Bar with Actions */}
      <div className="flex flex-col gap-2 pb-2">
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2.5">
            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                className="md:hidden relative shrink-0 w-8 h-8 rounded-full overflow-hidden border border-black/10 dark:border-white/15 active:scale-95 transition-transform"
                title="Open Profile & Status"
              >
                <img
                  src={
                    authUser?.profilePic ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.username || "User")}&background=27272a&color=ffffff&bold=true`
                  }
                  alt={authUser?.username || "User"}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 dark:bg-white ring-1 ring-white dark:ring-[#09090b]" />
              </button>
            )}
            <div className="flex items-center cursor-pointer" onClick={() => setSelectedChat(null)}>
              <h1 className="font-bold tracking-tight text-zinc-900 dark:text-white text-xl leading-tight">Chats</h1>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* WhatsApp 24-Hour Status Stories Button */}
            {onOpenStatus && (
              <button
                onClick={onOpenStatus}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
                title="Status Stories"
                type="button"
              >
                <span className="material-symbols-outlined text-lg">motion_photos_on</span>
              </button>
            )}

            {/* New Group Button */}
            <button
              onClick={handleOpenGroupModal}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
              title="New Group"
              type="button"
            >
              <span className="material-symbols-outlined text-lg">group_add</span>
            </button>

            {/* Add Contact Button */}
            <button
              onClick={onOpenAddFriend}
              className="relative p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
              title="Add Contact"
              type="button"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black font-mono text-[9px] font-bold shadow-md animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>

            {/* Options Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
                title="More options"
                type="button"
              >
                <span className="material-symbols-outlined text-lg">more_vert</span>
              </button>

              {showOptionsDropdown && (
                <div className="absolute right-0 top-9 w-52 rounded-2xl bg-white/95 dark:bg-[#14131a]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 p-1.5 shadow-2xl z-50 animate-scaleIn select-none text-zinc-900 dark:text-white">
                  {onOpenProfile && (
                    <button
                      onClick={() => { onOpenProfile(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-700 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-200 dark:hover:text-white dark:hover:bg-white/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-sm">person</span>
                      <span>My Profile</span>
                    </button>
                  )}
                  {onOpenStarred && (
                    <button
                      onClick={() => { onOpenStarred(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-700 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-200 dark:hover:text-white dark:hover:bg-white/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-sm">star</span>
                      <span>Starred Messages</span>
                    </button>
                  )}
                  {onOpenSetStatus && (
                    <button
                      onClick={() => { onOpenSetStatus(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-700 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-200 dark:hover:text-white dark:hover:bg-white/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-sm">sentiment_satisfied</span>
                      <span>Set Status Mood</span>
                    </button>
                  )}
                  {setIsWallpaperOpen && (
                    <button
                      onClick={() => { setIsWallpaperOpen(true); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-700 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-200 dark:hover:text-white dark:hover:bg-white/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-sm">wallpaper</span>
                      <span>Chat Wallpaper</span>
                    </button>
                  )}
                  {handleInstallPWA && (
                    <button
                      onClick={() => { handleInstallPWA(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-700 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-200 dark:hover:text-white dark:hover:bg-white/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-sm">install_desktop</span>
                      <span>Install Pulse PWA</span>
                    </button>
                  )}
                  {onToggleTheme && (
                    <button
                      onClick={() => { onToggleTheme(); setShowOptionsDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-700 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-200 dark:hover:text-white dark:hover:bg-white/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {theme === "dark" ? "light_mode" : "dark_mode"}
                      </span>
                      <span>Switch Theme</span>
                    </button>
                  )}
                  {logout && (
                    <>
                      <div className="my-1 border-t border-black/10 dark:border-white/10" />
                      <button
                        onClick={() => { logout(); setShowOptionsDropdown(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-red-500 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors text-left"
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

        {/* Search Bar with ⌘K */}
        <div className="relative flex items-center w-full mt-1">
          <span className="material-symbols-outlined absolute left-3 text-zinc-400 dark:text-zinc-500 pointer-events-none text-base">
            search
          </span>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 sm:pr-11 py-2 rounded-full text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400/50 dark:focus:ring-white/40 transition-all bg-black/[0.04] dark:bg-white/5 border border-black/10 dark:border-white/10"
            placeholder="Search or start new chat..."
            type="text"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 p-0.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors"
              title="Clear search"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          ) : (
            <kbd className="hidden sm:inline-block absolute right-3 px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-zinc-500 dark:text-zinc-400 font-mono text-[9px] pointer-events-none">
              ⌘K
            </kbd>
          )}
        </div>

        {/* WhatsApp-Standard Category Filter Tabs: All, Unread, Requests, Groups, Direct */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1.5">
          <button
            onClick={() => setActiveFilter("all")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === "all"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5"
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
                ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5"
            }`}
            type="button"
          >
            <span>Unread</span>
            {totalUnreadCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                activeFilter === "unread"
                  ? "bg-white text-zinc-900 dark:bg-black dark:text-white"
                  : "bg-zinc-900 text-white dark:bg-white dark:text-black"
              }`}>
                {totalUnreadCount}
              </span>
            )}
          </button>

          {pendingCount > 0 && (
            <button
              onClick={() => setActiveFilter("requests")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
                activeFilter === "requests"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-md font-bold"
                  : "text-zinc-900 bg-black/5 border border-black/10 hover:bg-black/10 dark:text-white dark:bg-white/10 dark:border-white/20 dark:hover:bg-white/20 font-semibold"
              }`}
              type="button"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-white animate-pulse" />
              <span>Requests</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                activeFilter === "requests"
                  ? "bg-white text-zinc-900 dark:bg-black dark:text-white"
                  : "bg-zinc-900 text-white dark:bg-white dark:text-black"
              }`}>
                {pendingCount}
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveFilter("groups")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === "groups"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5"
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
                ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-md font-bold"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5"
            }`}
            type="button"
          >
            <span>Direct</span>
            <span className="text-[10px] opacity-75 font-mono">({directCount})</span>
          </button>
        </div>
      </div>

      {/* 2. Pending Friend Requests Banner List */}
      {incomingRequests && incomingRequests.length > 0 && (
        <div className="my-2 p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 dark:border-white/20 backdrop-blur-xl shadow-glass flex flex-col gap-2 shrink-0 animate-fadeIn">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-white animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                Friend Requests ({incomingRequests.length})
              </span>
            </div>
            {onOpenAddFriend && (
              <button
                type="button"
                onClick={onOpenAddFriend}
                className="text-[10px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
              >
                View all
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
            {incomingRequests.map((req) => {
              const sender = req.sender || {};
              const isLoading = actionLoadingId === req._id;

              return (
                <div
                  key={req._id}
                  className="p-2 rounded-xl bg-black/[0.02] border border-black/10 hover:bg-black/[0.05] dark:bg-white/[0.04] dark:border-white/10 dark:hover:bg-white/[0.08] transition-all flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      className="w-8 h-8 rounded-full object-cover shrink-0 border border-black/10 dark:border-white/10"
                      alt={sender.username || "Contact"}
                      src={
                        sender.profilePic ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          sender.username || "User"
                        )}&background=27272a&color=ffffff`
                      }
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold truncate text-zinc-900 dark:text-white">
                        {sender.username || "Unknown User"}
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                        {sender.status || "Wants to connect"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAcceptRequest(req._id)}
                      disabled={isLoading}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-black text-[11px] font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 shadow-sm flex items-center gap-1 cursor-pointer"
                      title="Accept Request"
                    >
                      <span className="material-symbols-outlined text-xs">check</span>
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectRequest(req._id)}
                      disabled={isLoading}
                      className="p-1 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-red-500/10 dark:text-zinc-400 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Decline"
                    >
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Global User Search Results (When typing) */}
      {searchQuery.trim().length >= 2 && searchResults.length > 0 && (
        <div className="mb-2 p-2 rounded-2xl bg-white/95 dark:bg-[#14131a]/90 border border-black/10 dark:border-white/10 shadow-xl flex flex-col gap-1 shrink-0 max-h-48 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold px-1">
            Global Search
          </div>
          {searchResults.map((user) => {
            const isAlreadyFriend = friends.some((f) => f._id?.toString() === user._id?.toString()) || user.relationship === "friend";
            const isMe = user._id?.toString() === authUser?._id?.toString() || user.relationship === "self";
            const isPendingOutgoing =
              user.relationship === "pending_outgoing" ||
              outgoingRequests?.some((r) => (r.receiver?._id || r.receiver)?.toString() === user._id?.toString());
            const isPendingIncoming =
              user.relationship === "pending_incoming" ||
              incomingRequests?.some((r) => (r.sender?._id || r.sender)?.toString() === user._id?.toString());
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
                className="flex items-center justify-between p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={user.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || "User")}&background=27272a&color=ffffff`}
                    alt={user.username}
                    className="w-8 h-8 rounded-full object-cover border border-black/10 dark:border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white block truncate">{user.username}</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block truncate">{user.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                  {isMe ? (
                    <span className="text-[10px] text-zinc-500 font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5">You</span>
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
                      className="px-2.5 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black text-[11px] font-bold shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 flex items-center gap-1"
                      title="Open conversation"
                    >
                      <span className="material-symbols-outlined text-xs">chat</span>
                      <span>Chat</span>
                    </button>
                  ) : isPendingOutgoing ? (
                    <div className="px-2.5 py-1 rounded-full bg-black/5 border border-black/10 dark:bg-white/10 dark:border-white/20 text-zinc-600 dark:text-zinc-300 text-[10px] font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-zinc-900 dark:text-white">done</span>
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
                      className="px-2.5 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black text-[11px] font-bold shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 flex items-center gap-1"
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
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
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

        {/* Requests Tab Dedicated View */}
        {activeFilter === "requests" && (
          <div className="space-y-2 p-1">
            <div className="px-1 py-1 flex items-center justify-between text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              <span>Incoming Friend Requests</span>
              <span className="text-[9px] font-mono">{incomingRequests.length}</span>
            </div>
            {incomingRequests.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">No pending friend requests.</div>
            ) : (
              incomingRequests.map((req) => {
                const sender = req.sender || {};
                const isLoading = actionLoadingId === req._id;

                return (
                  <div
                    key={req._id}
                    className="p-3 rounded-2xl bg-black/[0.02] border border-black/10 hover:bg-black/[0.05] dark:bg-white/[0.05] dark:border-white/10 dark:hover:bg-white/[0.08] transition-all flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-black/10 dark:border-white/10 shadow-sm"
                        alt={sender.username || "User"}
                        src={
                          sender.profilePic ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            sender.username || "User"
                          )}&background=27272a&color=ffffff&bold=true`
                        }
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                          {sender.username || "Unknown User"}
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                          {sender.status || "Wants to connect"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAcceptRequest(req._id)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 shadow-sm flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xs">check</span>
                        <span>Accept</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectRequest(req._id)}
                        disabled={isLoading}
                        className="p-1.5 rounded-xl text-zinc-500 hover:text-red-500 hover:bg-red-500/10 dark:text-zinc-400 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                        title="Decline"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ALL TAB: Unified Chat Stream (Groups + Direct merged, chronologically sorted by recent activity) */}
        {activeFilter === "all" && (
          allChats.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No conversations yet. Start a chat or create a group!
            </div>
          ) : (
            allChats.map(renderChatCard)
          )
        )}

        {/* UNREAD TAB: Unified Unread Stream */}
        {activeFilter === "unread" && (
          unreadChats.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No unread messages.
            </div>
          ) : (
            unreadChats.map(renderChatCard)
          )
        )}

        {/* GROUPS TAB: Only Groups sorted by recent */}
        {activeFilter === "groups" && (
          sortedRooms.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No groups found.
            </div>
          ) : (
            sortedRooms.map(renderRoomCard)
          )
        )}

        {/* DIRECT TAB: Only Direct Chats sorted by recent */}
        {activeFilter === "direct" && (
          sortedFriends.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No direct chats found.
            </div>
          ) : (
            sortedFriends.map(renderFriendCard)
          )
        )}
      </div>

      {isLocalCreateGroupOpen && <CreateGroupModal onClose={() => setIsLocalCreateGroupOpen(false)} />}
    </section>
  );
};

export default Sidebar;
