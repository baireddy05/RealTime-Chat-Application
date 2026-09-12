import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useFriendStore } from "../store/useFriendStore";
import { useThemeStore } from "../store/useThemeStore";
import { 
  MessageSquare, Users, UserPlus, Check, X, UserX, Search, Loader, 
  MoreVertical, CircleDashed, LogOut, User, Clock, CheckCheck, Plus,
  Sun, Moon, Palette, Image as ImageIcon
} from "lucide-react";
import StatusModal from "./StatusModal";
import CreateGroupModal from "./CreateGroupModal";
import WallpaperModal from "./WallpaperModal";

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

const Sidebar = ({ onChatSelect, onOpenProfile }) => {
  const {
    rooms,
    getRooms,
    selectedChat,
    setSelectedChat,
    unreadCounts,
    lastMessages,
    isWallpaperOpen,
    setIsWallpaperOpen,
  } = useChatStore();
  const { theme, toggleTheme } = useThemeStore();

  const selectChat = (chat) => {
    setSelectedChat(chat);
    onChatSelect?.();
  };

  const { authUser, onlineUsers, logout } = useAuthStore();
  const { 
    friends, incomingRequests, searchResults, isFriendsLoading, isSearching,
    getFriends, getFriendRequests, searchUsers, sendFriendRequest, 
    acceptFriendRequest, rejectFriendRequest, removeFriend,
    subscribeToFriendEvents, unsubscribeFromFriendEvents
  } = useFriendStore();

  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);

  useEffect(() => {
    getRooms();
    getFriends();
    getFriendRequests();
    subscribeToFriendEvents();
    return () => { unsubscribeFromFriendEvents(); };
  }, [getRooms, getFriends, getFriendRequests, subscribeToFriendEvents, unsubscribeFromFriendEvents]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length > 0 && activeFilter === "add") {
        searchUsers(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeFilter, searchUsers]);

  const handleSendRequest = async (userId) => { setActionLoadingId(userId); await sendFriendRequest(userId); setActionLoadingId(null); };
  const handleAcceptRequest = async (requestId) => { setActionLoadingId(requestId); await acceptFriendRequest(requestId); setActionLoadingId(null); };
  const handleRejectRequest = async (requestId) => { setActionLoadingId(requestId); await rejectFriendRequest(requestId); setActionLoadingId(null); };
  const handleRemoveFriend = async (userId) => {
    if (window.confirm("Remove this friend from your contacts?")) {
      setActionLoadingId(userId);
      await removeFriend(userId);
      if (selectedChat?.id === userId) setSelectedChat(null);
      setActionLoadingId(null);
    }
  };

  const pendingCount = incomingRequests.length;
  const filteredRooms = rooms.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFriends = friends.filter((f) => f.username.toLowerCase().includes(searchQuery.toLowerCase()));

  const filterBtn = (key, label, count) => {
    const active = activeFilter === key;
    return (
      <button
        onClick={() => setActiveFilter(key)}
        className={`px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all flex-shrink-0 active:scale-[0.97] ${
          active
            ? "liquid-pill-active"
            : "liquid-pill-inactive"
        }`}
      >
        {label}{count !== undefined ? ` (${count})` : ""}
      </button>
    );
  };

  return (
    <aside className="w-full md:w-80 lg:w-[340px] flex flex-col h-full select-none relative bg-transparent">
      {/* Header */}
      <div className="h-[60px] border-b border-[var(--glass-border)] px-4 flex items-center justify-between flex-shrink-0 relative z-30">
        {/* User Profile & Brand */}
        <div className="flex items-center gap-3">
          <div onClick={onOpenProfile} className="relative cursor-pointer group" title="Profile & Settings">
            <img
              src={authUser?.profilePic || `https://ui-avatars.com/api/?name=${authUser?.username}&background=2563eb&color=ffffff&bold=true`}
              alt="Profile"
              className="w-9 h-9 rounded-full object-cover ring-1 ring-[var(--glass-border)] group-hover:ring-accent-primary transition-all"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-status-online ring-2 ring-[var(--glass-surface)]" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-[14px] text-theme-main tracking-tight">Pulse</span>
            <p className="text-[11px] text-theme-muted truncate max-w-[100px]">{authUser?.username}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-0.5 relative">
          {/* Theme Switcher Button */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-[var(--glass-hover)] text-theme-muted hover:text-accent-primary transition-all relative"
            title={theme === "dark" ? "Switch to Arctic Prism (Light Mode)" : "Switch to Cosmic Obsidian (Dark Mode)"}
          >
            {theme === "dark" ? (
              <Sun size={17} className="text-amber-400 hover:rotate-45 transition-transform" />
            ) : (
              <Moon size={17} className="text-accent-primary hover:-rotate-12 transition-transform" />
            )}
          </button>

          <button
            onClick={() => setIsStatusOpen(true)}
            className="p-2 rounded-lg hover:bg-[var(--glass-hover)] text-theme-muted hover:text-accent-primary transition-all relative"
            title="Stories & Status"
          >
            <CircleDashed size={17} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent-primary" />
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === "add" ? "all" : "add")}
            className={`p-2 rounded-lg transition-all relative ${
              activeFilter === "add" ? "text-accent-primary bg-accent-primary/20" : "text-theme-muted hover:bg-[var(--glass-hover)] hover:text-theme-main"
            }`}
            title="Add contact"
          >
            <UserPlus size={17} />
            {pendingCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-accent-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center shadow">
                {pendingCount}
              </span>
            )}
          </button>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenuDropdown((prev) => !prev); }}
              className="p-2 rounded-lg hover:bg-[var(--glass-hover)] text-theme-muted hover:text-theme-main transition-all"
              title="Menu"
            >
              <MoreVertical size={17} />
            </button>

            {showMenuDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenuDropdown(false)} />
                <div className="absolute right-0 top-10 z-50 bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl shadow-glass py-1.5 w-52 animate-scaleIn smooth-gpu text-[13px]">
                  <button onClick={() => { toggleTheme(); setShowMenuDropdown(false); }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center gap-2.5 transition-colors text-theme-main">
                    {theme === "dark" ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-accent-primary" />}
                    <span>{theme === "dark" ? "Light: Arctic Prism" : "Dark: Cosmic Obsidian"}</span>
                  </button>
                  <button onClick={() => { setIsStatusOpen(true); setShowMenuDropdown(false); }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center gap-2.5 transition-colors text-theme-main hover:text-accent-primary">
                    <CircleDashed size={15} className="text-accent-primary" /> Status Stories
                  </button>
                  <button onClick={() => { setIsCreateGroupOpen(true); setShowMenuDropdown(false); }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center gap-2.5 transition-colors text-theme-main hover:text-accent-primary">
                    <Plus size={15} className="text-accent-primary" /> New Channel
                  </button>
                  <button onClick={() => { setActiveFilter("contacts"); setShowMenuDropdown(false); }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center gap-2.5 transition-colors text-theme-main">
                    <Users size={15} className="text-theme-muted" /> Contacts
                  </button>
                  <button onClick={() => { setIsWallpaperOpen(true); setShowMenuDropdown(false); }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center gap-2.5 transition-colors text-theme-main hover:text-accent-primary">
                    <Palette size={15} className="text-accent-primary" /> Chat Wallpaper
                  </button>
                  <button onClick={() => { onOpenProfile?.(); setShowMenuDropdown(false); }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--glass-hover)] flex items-center gap-2.5 transition-colors text-theme-main">
                    <User size={15} className="text-theme-muted" /> Profile
                  </button>
                  <div className="border-t border-[var(--glass-border)] my-1" />
                  <button onClick={() => { logout(); setShowMenuDropdown(false); }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-red-500/15 text-red-400/80 hover:text-red-400 flex items-center gap-2.5 transition-colors">
                    <LogOut size={15} /> Log Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-3 border-b border-[var(--glass-border)] space-y-2.5">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-3 text-theme-muted/50" />
          <input
            type="text"
            placeholder={activeFilter === "add" ? "Search contacts..." : "Search..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full glass-input rounded-xl pl-8.5 pr-8 py-2 text-[13px] text-theme-main placeholder-theme-muted/50 border border-[var(--glass-border)] focus:outline-none focus:border-accent-primary/70 transition-all"
            style={{ paddingLeft: '34px' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 text-theme-muted/60 hover:text-theme-main">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {filterBtn("all", "All")}
          {filterBtn("groups", "Channels", rooms.length)}
          {filterBtn("contacts", "Contacts", friends.length)}
          <button
            id="filter-add-btn"
            onClick={() => setActiveFilter("add")}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all flex-shrink-0 flex items-center gap-1.5 active:scale-[0.97] ${
              activeFilter === "add"
                ? "liquid-pill-active"
                : "liquid-pill-inactive"
            }`}
          >
            <UserPlus size={11} />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {/* All & Groups View */}
        {(activeFilter === "all" || activeFilter === "groups") && (
          <div className="space-y-0.5">
            {activeFilter === "groups" && (
              <div className="flex items-center justify-between px-2 py-2 mb-1">
                <span className="text-[11px] font-medium text-theme-muted/60 tracking-wider">CHANNELS</span>
                <button onClick={() => setIsCreateGroupOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-medium text-accent-primary hover:text-accent-primary/80 px-2 py-1 rounded-lg hover:bg-accent-primary/15 transition-colors">
                  <Plus size={12} /> New
                </button>
              </div>
            )}

            {filteredRooms.map((room) => {
              const isSelected = selectedChat?.id === room._id;
              const displayName = room.name.replace(/^#/, "");
              const unread = unreadCounts[room._id] || 0;
              const last = lastMessages[room._id] || room.lastMessage;
              const hasUnread = unread > 0;

              return (
                <div
                  key={room._id}
                  id={`channel-${displayName.toLowerCase()}`}
                  data-testid={`channel-${displayName.toLowerCase()}`}
                  onClick={() => selectChat({ id: room._id, type: "room", name: room.name })}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? "bg-accent-primary/20 border border-accent-primary/40 shadow-sm"
                      : "hover:bg-[var(--glass-hover)]"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-primary/25 to-accent-secondary/25 flex items-center justify-center text-accent-primary font-semibold text-[12px] flex-shrink-0 border border-[var(--glass-border)]">
                    {displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h4 className={`font-medium text-[13px] truncate capitalize ${hasUnread ? "text-theme-main font-semibold" : "text-theme-main"}`}>
                        {displayName}
                      </h4>
                      <span className="text-[10px] text-theme-muted/50 ml-2 flex-shrink-0">
                        {last?.createdAt ? formatTimeRelative(last.createdAt) : "Channel"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-[11px] truncate ${hasUnread ? "text-theme-main font-medium" : "text-theme-muted"}`}>
                        {last ? (
                          <>
                            {last.senderId?.username ? `${last.senderId.username}: ` : ""}
                            {last.decryptedText || (last.text?.startsWith("[e2ee]:") ? "🔒 Encrypted Message" : last.text) || (last.image ? "📷 Photo" : last.file ? `📎 ${last.file.name}` : last.audio ? "🎤 Voice" : "Attachment")}
                          </>
                        ) : (
                          room.description || "Channel chat"
                        )}
                      </p>
                      {hasUnread && (
                        <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-accent-primary to-accent-secondary text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Direct contacts in All view */}
            {activeFilter === "all" && (
              <>
                {filteredFriends.length === 0 && filteredRooms.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <MessageSquare size={28} className="mx-auto mb-3 text-theme-muted/30" />
                    <p className="text-[13px] font-medium text-theme-muted">No conversations</p>
                    <button onClick={() => setActiveFilter("add")} className="mt-2 text-[12px] text-accent-primary hover:underline font-medium">
                      Find contacts
                    </button>
                  </div>
                ) : (
                  filteredFriends.map((friend) => {
                    const isOnline = onlineUsers.includes(friend._id);
                    const isSelected = selectedChat?.id === friend._id;
                    const unread = unreadCounts[friend._id] || 0;
                    const last = lastMessages[friend._id] || friend.lastMessage;
                    const hasUnread = unread > 0;

                    return (
                      <div
                        key={friend._id}
                        onClick={() => selectChat({ id: friend._id, type: "user", name: friend.username })}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? "bg-accent-primary/20 border border-accent-primary/40 shadow-sm"
                            : "hover:bg-[var(--glass-hover)]"
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <img
                            src={friend.profilePic || `https://ui-avatars.com/api/?name=${friend.username}&background=2563eb&color=ffffff`}
                            alt={friend.username}
                            className="w-10 h-10 rounded-full object-cover border border-[var(--glass-border)]"
                          />
                          {isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-status-online ring-2 ring-[var(--glass-surface)]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <h4 className={`font-medium text-[13px] truncate ${hasUnread ? "text-theme-main font-semibold" : "text-theme-main"}`}>
                              {friend.username}
                            </h4>
                            <span className={`text-[10px] flex-shrink-0 ${hasUnread ? "text-accent-primary font-semibold" : isOnline ? "text-status-online font-medium" : "text-theme-muted/40"}`}>
                              {last?.createdAt ? formatTimeRelative(last.createdAt) : isOnline ? "Online" : "Offline"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-[11px] truncate flex items-center gap-1 ${hasUnread ? "text-theme-main font-medium" : "text-theme-muted"}`}>
                              <CheckCheck size={12} className={hasUnread ? "text-accent-primary font-bold" : "text-accent-primary"} />
                              <span>
                                {last
                                  ? (last.decryptedText || (last.text?.startsWith("[e2ee]:") ? "🔒 Encrypted Message" : last.text) || (last.image ? "📷 Photo" : last.file ? `📎 ${last.file.name}` : last.audio ? "🎤 Voice Note" : "Attachment"))
                                  : (friend.status || "Available")}
                              </span>
                            </p>
                            {hasUnread && (
                              <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-accent-primary to-accent-secondary text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                                {unread > 99 ? "99+" : unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        )}

        {/* Contacts View */}
        {activeFilter === "contacts" && (
          <div className="space-y-3 p-1">
            {incomingRequests.length > 0 && (
              <div className="p-3 rounded-2xl glass-surface border border-[var(--glass-border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-accent-primary tracking-wide">REQUESTS ({incomingRequests.length})</span>
                  <Clock size={13} className="text-theme-muted/50" />
                </div>
                <div className="space-y-1.5">
                  {incomingRequests.map((req) => (
                    <div key={req._id} className="flex items-center justify-between p-2.5 bg-[var(--glass-hover)] rounded-xl border border-[var(--glass-border)]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img src={req.sender.profilePic || `https://ui-avatars.com/api/?name=${req.sender.username}`}
                          alt={req.sender.username} className="w-8 h-8 rounded-full object-cover" />
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-theme-main truncate">{req.sender.username}</p>
                          <p className="text-[10px] text-theme-muted">Wants to connect</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleAcceptRequest(req._id)} disabled={actionLoadingId === req._id}
                          className="p-1.5 rounded-lg bg-accent-primary hover:bg-accent-primary/80 text-white transition-colors shadow-sm" title="Accept">
                          <Check size={12} />
                        </button>
                        <button onClick={() => handleRejectRequest(req._id)} disabled={actionLoadingId === req._id}
                          className="p-1.5 rounded-lg bg-[var(--glass-hover)] hover:bg-red-500/15 text-theme-muted hover:text-red-400 transition-colors" title="Decline">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="text-[11px] font-medium text-theme-muted/60 tracking-wider block mb-2 px-1">CONTACTS ({friends.length})</span>
              {isFriendsLoading ? (
                <div className="flex justify-center p-8"><Loader className="animate-spin text-accent-primary size-5" /></div>
              ) : friends.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <Users size={24} className="mx-auto mb-2 text-theme-muted/30" />
                  <p className="text-[12px] text-theme-muted">No contacts yet</p>
                  <button onClick={() => setActiveFilter("add")} className="mt-2 text-[12px] text-accent-primary font-medium hover:underline">Add a friend</button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredFriends.map((friend) => {
                    const isOnline = onlineUsers.includes(friend._id);
                    return (
                      <div key={friend._id} className="flex items-center justify-between p-2 rounded-xl hover:bg-[var(--glass-hover)] transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative flex-shrink-0">
                            <img src={friend.profilePic || `https://ui-avatars.com/api/?name=${friend.username}`}
                              alt={friend.username} className="w-9 h-9 rounded-full object-cover border border-[var(--glass-border)]" />
                            {isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-status-online ring-2 ring-[var(--glass-surface)]" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-theme-main truncate">{friend.username}</p>
                            <p className="text-[11px] text-theme-muted truncate">{friend.status || "Available"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => selectChat({ id: friend._id, type: "user", name: friend.username })}
                            className="p-1.5 rounded-lg text-accent-primary hover:bg-accent-primary/20 transition-colors" title="Chat">
                            <MessageSquare size={14} />
                          </button>
                          <button onClick={() => handleRemoveFriend(friend._id)} disabled={actionLoadingId === friend._id}
                            className="p-1.5 rounded-lg text-theme-muted hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remove">
                            <UserX size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Friend View */}
        {activeFilter === "add" && (
          <div className="p-1 space-y-3">
            <div className="p-3 rounded-2xl glass-surface border border-[var(--glass-border)] flex items-center gap-2.5 text-[12px] text-theme-muted">
              <UserPlus size={14} className="flex-shrink-0 text-accent-primary" />
              <span>Search by username to send friend requests</span>
            </div>

            {isSearching ? (
              <div className="flex justify-center p-10"><Loader className="animate-spin text-accent-primary size-5" /></div>
            ) : searchQuery.trim().length === 0 ? (
              <div className="text-center py-12 px-4">
                <Search size={24} className="mx-auto mb-2 text-theme-muted/30" />
                <p className="text-[12px] text-theme-muted/60">Type a username above</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-10 px-4">
                <p className="text-[12px] text-theme-muted/60">No users found for "{searchQuery}"</p>
              </div>
            ) : (
              <div className="space-y-1">
                {searchResults.map((user) => {
                  const isFriend = user.relationship === "friend";
                  const isPendingOut = user.relationship === "pending_outgoing";
                  const isPendingIn = user.relationship === "pending_incoming";
                  const isSelf = user._id === authUser._id;
                  if (isSelf) return null;

                  return (
                    <div key={user._id} className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--glass-border)] hover:bg-[var(--glass-hover)] transition-all">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img src={user.profilePic || `https://ui-avatars.com/api/?name=${user.username}`}
                          alt={user.username} className="w-9 h-9 rounded-full object-cover border border-[var(--glass-border)]" />
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-theme-main truncate">{user.username}</p>
                          <p className="text-[10px] text-theme-muted truncate">{user.status || "Pulse user"}</p>
                        </div>
                      </div>
                      <div>
                        {isFriend ? (
                          <span className="text-[11px] font-medium text-status-online bg-status-online/15 px-2.5 py-1 rounded-lg">Friend</span>
                        ) : isPendingOut ? (
                          <span className="text-[11px] font-medium text-accent-secondary bg-accent-secondary/15 border border-accent-secondary/30 px-2.5 py-1 rounded-lg">Sent</span>
                        ) : isPendingIn ? (
                          <span className="text-[11px] font-medium text-accent-primary bg-accent-primary/15 px-2.5 py-1 rounded-lg">Requested</span>
                        ) : (
                          <button onClick={() => handleSendRequest(user._id)} disabled={actionLoadingId === user._id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-primary hover:bg-accent-primary/85 text-white font-medium text-[11px] shadow-sm transition-all active:scale-[0.97] disabled:opacity-50 cursor-pointer">
                            {actionLoadingId === user._id ? <Loader size={11} className="animate-spin text-white" /> : <UserPlus size={11} className="text-white" />}
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
        )}
      </div>

      {isStatusOpen && <StatusModal onClose={() => setIsStatusOpen(false)} />}
      {isCreateGroupOpen && <CreateGroupModal onClose={() => setIsCreateGroupOpen(false)} />}
      {isWallpaperOpen && <WallpaperModal isOpen={isWallpaperOpen} onClose={() => setIsWallpaperOpen(false)} />}
    </aside>
  );
};

export default Sidebar;
