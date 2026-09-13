import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import ChatPane from "../components/ChatPane";
import ProfileModal from "../components/ProfileModal";
import CallModal from "../components/CallModal";
import IncomingCallModal from "../components/IncomingCallModal";
import SetStatusModal from "../components/SetStatusModal";
import WallpaperModal from "../components/WallpaperModal";
import AddFriendModal from "../components/AddFriendModal";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useCallStore } from "../store/useCallStore";
import { useFriendStore } from "../store/useFriendStore";
import { useThemeStore } from "../store/useThemeStore";
import { usePWAInstall } from "../hooks/usePWAInstall";

const HomePage = () => {
  const { selectedChat, setSelectedChat, rooms, getRooms, isWallpaperOpen, setIsWallpaperOpen, unreadCounts } = useChatStore();
  const { socket, authUser, logout } = useAuthStore();
  const { initSocketListeners } = useCallStore();
  const { friends, incomingRequests, getFriends, getFriendRequests } = useFriendStore();
  const { theme, toggleTheme } = useThemeStore();
  const { isInstallable, promptInstall } = usePWAInstall();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSetStatusOpen, setIsSetStatusOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("all-chats");

  // WebRTC calling listeners
  useEffect(() => {
    if (socket && authUser) {
      initSocketListeners(socket, authUser);
    }
  }, [socket, authUser, initSocketListeners]);

  useEffect(() => {
    getRooms();
    getFriends();
    getFriendRequests();
  }, [getRooms, getFriends, getFriendRequests]);

  // Extract status display
  const rawStatus = authUser?.status || "Coding: Available";
  let statusEmoji = "💻";
  let statusCategory = "Coding";
  let statusDetail = "Available";

  if (rawStatus.includes(":")) {
    const parts = rawStatus.split(":");
    const prefix = parts[0].trim();
    statusDetail = parts.slice(1).join(":").trim();
    const emojiMatch = prefix.match(/\p{Extended_Pictographic}/u);
    if (emojiMatch) {
      statusEmoji = emojiMatch[0];
      statusCategory = prefix.replace(emojiMatch[0], "").trim() || "Status";
    } else {
      statusCategory = prefix;
    }
  } else {
    const emojiMatch = rawStatus.match(/\p{Extended_Pictographic}/u);
    if (emojiMatch) {
      statusEmoji = emojiMatch[0];
      statusDetail = rawStatus.replace(emojiMatch[0], "").trim();
      statusCategory = "Presence";
    } else {
      statusDetail = rawStatus;
    }
  }

  const pendingCount = incomingRequests?.length || 0;
  const totalUnreadCount = Object.values(unreadCounts || {}).reduce((acc, c) => acc + (c || 0), 0);

  const handleInstallPWA = async () => {
    if (isInstallable) {
      await promptInstall();
    } else {
      alert("Pulse Messenger is ready! You can install it via your browser menu (Add to Home Screen or Install App).");
    }
  };

  const handleChannelSelect = (room) => {
    setSelectedChat({
      id: room._id,
      name: room.name,
      type: "room",
      description: room.description,
      members: room.members,
    });
  };

  const generalRoom = rooms.find((r) => r.name.toLowerCase().includes("general")) || rooms[0];
  const voiceRoom = rooms.find((r) => r.name.toLowerCase().includes("dev-hangout") || r.name.toLowerCase().includes("voice")) || rooms[1] || rooms[0];

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex flex-row p-2 sm:p-2.5 md:p-3 gap-2 sm:gap-2.5 md:gap-3 bg-transparent text-on-surface antialiased select-none relative font-sans transition-colors duration-200">
      {/* 1. Monochromatic Breathing Pulse Animation Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#09090b]">
        {/* Breathing glowing monochromatic radial orbs */}
        <div className="absolute top-1/2 left-1/2 w-[900px] h-[900px] rounded-full bg-white/[0.07] blur-[150px] animate-bg-pulse-1" />
        <div className="absolute top-1/4 left-1/4 w-[650px] h-[650px] rounded-full bg-zinc-300/[0.05] blur-[130px] animate-bg-pulse-2" />
        <div className="absolute bottom-1/4 right-1/4 w-[750px] h-[750px] rounded-full bg-white/[0.06] blur-[140px] animate-bg-pulse-1" style={{ animationDelay: "-3s" }} />

        {/* Concentric Rhythmic Expanding Pulse Waves */}
        <div className="absolute top-1/2 left-1/2 w-[550px] h-[550px] rounded-full border border-white/[0.08] animate-bg-pulse-wave-1 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 w-[550px] h-[550px] rounded-full border border-white/[0.05] animate-bg-pulse-wave-2 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 w-[550px] h-[550px] rounded-full border border-white/[0.03] animate-bg-pulse-wave-3 pointer-events-none" />
      </div>

      {/* 2. Zone 1: Slim Activity Rail (Floating Island: 64px width on md+) */}
      <nav
        aria-label="Activity Rail"
        className="hidden md:flex w-16 h-full flex-col items-center justify-between py-3.5 z-40 glass-panel rounded-2xl md:rounded-3xl border border-[var(--glass-border)] border-t-[var(--glass-border-top)] shadow-glass shrink-0 transition-all duration-200"
      >
        {/* Top: Pulse Glowing Monogram */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => {
              setSelectedChat(null);
              setActiveNav("all-chats");
            }}
            className="group relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-white to-zinc-400 p-0.5 shadow-md hover:scale-105 active:scale-95 transition-all"
            title="Pulse Home"
            type="button"
          >
            <div className="w-full h-full rounded-[14px] bg-surface-container flex items-center justify-center">
              <img alt="Pulse Logo" className="w-6 h-6 object-contain" src="/logo.svg" />
            </div>
            <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-surface-container-highest text-on-surface text-[11px] font-medium shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Pulse Home
            </span>
          </button>

          <div className="w-8 h-[1px] bg-outline-variant/30" />

          {/* Core Navigation Items */}
          <div className="flex flex-col items-center gap-2">
            {/* All Chats */}
            <button
              onClick={() => {
                setActiveNav("all-chats");
              }}
              className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                activeNav === "all-chats"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-outline hover:text-on-surface hover:bg-white/5"
              }`}
              title="All Chats"
              type="button"
            >
              {activeNav === "all-chats" && (
                <span className="absolute -left-3 w-1 h-5 rounded-r-full bg-white" />
              )}
              <span className="material-symbols-outlined text-xl">chat_bubble</span>
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-black font-mono text-[9px] flex items-center justify-center font-bold animate-pulse">
                  {totalUnreadCount}
                </span>
              )}
              <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-surface-container-highest text-on-surface text-[11px] font-medium shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                All Chats
              </span>
            </button>

            {/* Voice Rooms */}
            <button
              onClick={() => {
                setActiveNav("voice-rooms");
                if (voiceRoom) handleChannelSelect(voiceRoom);
              }}
              className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                activeNav === "voice-rooms"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-outline hover:text-on-surface hover:bg-white/5"
              }`}
              title="Voice Rooms"
              type="button"
            >
              {activeNav === "voice-rooms" && (
                <span className="absolute -left-3 w-1 h-5 rounded-r-full bg-white" />
              )}
              <span className="material-symbols-outlined text-xl">record_voice_over</span>
              <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-surface-container-highest text-on-surface text-[11px] font-medium shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                Voice Rooms
              </span>
            </button>

            {/* Contacts */}
            <button
              onClick={() => {
                setActiveNav("contacts");
                setIsContactsModalOpen(true);
              }}
              className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                activeNav === "contacts"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-outline hover:text-on-surface hover:bg-white/5"
              }`}
              title="Contacts & Friends"
              type="button"
            >
              {activeNav === "contacts" && (
                <span className="absolute -left-3 w-1 h-5 rounded-r-full bg-white" />
              )}
              <span className="material-symbols-outlined text-xl">group</span>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-black font-mono text-[9px] flex items-center justify-center font-bold animate-pulse">
                  {pendingCount}
                </span>
              )}
              <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-surface-container-highest text-on-surface text-[11px] font-medium shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                Contacts ({friends?.length || 0})
              </span>
            </button>
          </div>
        </div>

        {/* Bottom Stack: Theme, Profile */}
        <div className="flex flex-col items-center gap-3">

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="group relative flex items-center justify-center w-9 h-9 rounded-xl text-outline hover:text-on-surface hover:bg-white/5 transition-colors"
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            type="button"
          >
            <span className="material-symbols-outlined text-lg">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
            <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-surface-container-highest text-on-surface text-[11px] font-medium shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          </button>

          {/* User Profile Avatar */}
          <div
            onClick={() => setIsProfileOpen(true)}
            className="group relative cursor-pointer"
            title={`Profile: ${authUser?.username || "User"}`}
          >
            <div className="w-9 h-9 rounded-xl overflow-hidden p-0.5 bg-gradient-to-tr from-white to-zinc-400 hover:scale-105 active:scale-95 transition-transform shadow-md">
              <img
                alt={authUser?.username || "Profile"}
                className="w-full h-full rounded-[10px] object-cover"
                src={
                  authUser?.profilePic ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    authUser?.username || "User"
                  )}&background=27272a&color=ffffff&bold=true`
                }
              />
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-white ring-2 ring-[#0a0e14]" />
            <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-surface-container-highest text-on-surface text-[11px] font-medium shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Profile & Settings
            </span>
          </div>
        </div>
      </nav>

      {/* 3. Zone 2: Conversation Sidebar (Floating Island) */}
      <div
        className={`w-full md:w-80 lg:w-[340px] xl:w-[360px] h-full z-30 shrink-0 flex flex-col glass-panel rounded-2xl md:rounded-3xl border border-[var(--glass-border)] border-t-[var(--glass-border-top)] shadow-glass overflow-hidden transition-all duration-200 ${
          selectedChat ? "hidden md:flex" : "flex"
        }`}
      >
        <Sidebar
          onChatSelect={() => {}}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenSetStatus={() => setIsSetStatusOpen(true)}
          onOpenAddFriend={() => setIsAddFriendOpen(true)}
          onToggleTheme={toggleTheme}
          theme={theme}
          authUser={authUser}
          rawStatus={rawStatus}
          statusEmoji={statusEmoji}
          statusCategory={statusCategory}
          statusDetail={statusDetail}
          handleInstallPWA={handleInstallPWA}
          logout={logout}
          setIsWallpaperOpen={setIsWallpaperOpen}
        />
      </div>

      {/* 4. Zone 3: Master Active Chat Workstation or Liquid Glass Command Center (Floating Island) */}
      <main
        className={`flex-1 h-full z-20 overflow-hidden flex flex-col glass-panel rounded-2xl md:rounded-3xl border border-[var(--glass-border)] border-t-[var(--glass-border-top)] shadow-glass transition-all duration-200 ${
          !selectedChat ? "hidden md:flex" : "flex"
        }`}
      >
        {selectedChat ? (
          <ChatPane onBack={() => setSelectedChat(null)} />
        ) : (
          /* Premium Liquid Glass Command Center (Executive Empty State) */
          <div className="flex-1 h-full flex flex-col items-center justify-center p-6 md:p-12 relative overflow-y-auto custom-scrollbar select-none">
            <div className="max-w-xl w-full flex flex-col items-center text-center z-10 animate-fadeIn">
              {/* Glowing Ambient Hero Emblem */}
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-accent-primary to-accent-secondary blur-xl opacity-30 animate-pulse" />
                <div className="relative w-20 h-20 rounded-3xl bg-surface-container/90 backdrop-blur-2xl border border-outline-variant/30 shadow-2xl flex items-center justify-center">
                  <img src="/logo.svg" alt="Pulse" className="w-12 h-12 object-contain" />
                </div>
              </div>

              {/* Personalized Greeting */}
              <h2 className="text-2xl md:text-3xl font-bold text-on-surface tracking-tight mb-2">
                Welcome to Pulse, {authUser?.username || "Commander"}
              </h2>
              <p className="text-sm text-outline max-w-md mb-8">
                Your zero-knowledge encrypted workspace is armed and ready. Select a channel or initiate a secure direct line.
              </p>

              {/* 4 Quick Launch Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-8">
                {/* 1. General Discussion */}
                <button
                  onClick={() => generalRoom && handleChannelSelect(generalRoom)}
                  className="group flex items-center gap-3.5 p-3.5 rounded-2xl bg-surface/80 hover:bg-surface-bright/90 border border-outline-variant/20 hover:border-primary/40 backdrop-blur-xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:scale-[1.02]"
                  type="button"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <span className="text-lg font-bold">#</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-on-surface block truncate">#general channel</span>
                    <span className="text-[11px] text-outline block truncate">Community discussions & updates</span>
                  </div>
                </button>

                {/* 2. Custom Status & Presence */}
                <button
                  onClick={() => setIsSetStatusOpen(true)}
                  className="group flex items-center gap-3.5 p-3.5 rounded-2xl bg-surface/80 hover:bg-surface-bright/90 border border-outline-variant/20 hover:border-secondary/40 backdrop-blur-xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:scale-[1.02]"
                  type="button"
                >
                  <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-lg">mood</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-on-surface block truncate">Status & Presence</span>
                    <span className="text-[11px] text-outline block truncate">Set rich status, emoji & bio</span>
                  </div>
                </button>

                {/* 3. Voice Lounge */}
                <button
                  onClick={() => voiceRoom && handleChannelSelect(voiceRoom)}
                  className="group flex items-center gap-3.5 p-3.5 rounded-2xl bg-surface/80 hover:bg-surface-bright/90 border border-outline-variant/20 hover:border-tertiary/40 backdrop-blur-xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:scale-[1.02]"
                  type="button"
                >
                  <div className="w-10 h-10 rounded-xl bg-tertiary/15 text-tertiary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-lg">record_voice_over</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-on-surface block truncate">Voice Lounge</span>
                    <span className="text-[11px] text-outline block truncate">Live audio & video huddles</span>
                  </div>
                </button>

                {/* 4. Connect Contacts */}
                <button
                  onClick={() => setIsAddFriendOpen(true)}
                  className="group flex items-center gap-3.5 p-3.5 rounded-2xl bg-surface/80 hover:bg-surface-bright/90 border border-outline-variant/20 hover:border-primary/40 backdrop-blur-xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:scale-[1.02]"
                  type="button"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-lg">person_add</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-on-surface block truncate">Connect Contacts</span>
                    <span className="text-[11px] text-outline block truncate">Send zero-knowledge direct line</span>
                  </div>
                </button>
              </div>

              {/* Bottom Cryptographic Security Assurance Pill */}
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container border border-outline-variant/20 text-tertiary font-mono text-[11px] shadow-sm">
                <span className="material-symbols-outlined text-sm">lock</span>
                <span>256-bit AES-GCM • Signal Protocol E2EE • TLS 1.3 Verified</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals & Overlays */}
      {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} />}
      {isSetStatusOpen && <SetStatusModal onClose={() => setIsSetStatusOpen(false)} />}
      {isWallpaperOpen && <WallpaperModal onClose={() => setIsWallpaperOpen(false)} />}
      {(isAddFriendOpen || isContactsModalOpen) && (
        <AddFriendModal
          onClose={() => {
            setIsAddFriendOpen(false);
            setIsContactsModalOpen(false);
          }}
        />
      )}

      {/* WebRTC Video & Audio Call Overlays */}
      <CallModal />
      <IncomingCallModal />
    </div>
  );
};

export default HomePage;
