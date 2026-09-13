import { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import ChatPane from "../components/ChatPane";
import ProfileModal from "../components/ProfileModal";
import CallModal from "../components/CallModal";
import IncomingCallModal from "../components/IncomingCallModal";
import SetStatusModal from "../components/SetStatusModal";
import WallpaperModal from "../components/WallpaperModal";
import AddFriendModal from "../components/AddFriendModal";
import StatusModal from "../components/StatusModal";
import StarredDrawer from "../components/StarredDrawer";
import CreateGroupModal from "../components/CreateGroupModal";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useCallStore } from "../store/useCallStore";
import { useFriendStore } from "../store/useFriendStore";
import { useThemeStore } from "../store/useThemeStore";
import { usePWAInstall } from "../hooks/usePWAInstall";
import TypingPulseBackground from "../components/TypingPulseBackground";

const HomePage = () => {
  const { selectedChat, setSelectedChat, rooms, getRooms, isWallpaperOpen, setIsWallpaperOpen, unreadCounts, isStarredOpen, setIsStarredOpen } = useChatStore();
  const { socket, authUser, logout } = useAuthStore();
  const { initSocketListeners } = useCallStore();
  const { friends, incomingRequests, getFriends, getFriendRequests } = useFriendStore();
  const { theme, toggleTheme } = useThemeStore();
  const { isInstallable, promptInstall } = usePWAInstall();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSetStatusOpen, setIsSetStatusOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [isStatusStoriesOpen, setIsStatusStoriesOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("chats");

  // Logo coordinate tracking for background pulse waves
  const logoRef = useRef(null);
  const commandCenterRef = useRef(null);
  const [logoCoords, setLogoCoords] = useState(null);

  useEffect(() => {
    const updateLogoCoords = () => {
      if (logoRef.current && commandCenterRef.current) {
        const cRect = commandCenterRef.current.getBoundingClientRect();
        const lRect = logoRef.current.getBoundingClientRect();
        setLogoCoords({
          x: lRect.left + lRect.width / 2 - cRect.left,
          y: lRect.top + lRect.height / 2 - cRect.top,
        });
      }
    };

    updateLogoCoords();
    window.addEventListener("resize", updateLogoCoords);
    return () => window.removeEventListener("resize", updateLogoCoords);
  }, [selectedChat]);

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

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex flex-row p-2 sm:p-2.5 md:p-3 gap-2 sm:gap-2.5 md:gap-3 bg-transparent text-on-surface antialiased select-none relative font-sans transition-colors duration-200">
      {/* 1. Dynamic Liquid Glass Pulse Shockwave Background */}
      <TypingPulseBackground />

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
            type="button"
          >
            <div className="w-full h-full rounded-[14px] bg-[#121117] flex items-center justify-center">
              <img alt="Pulse Logo" className="w-6 h-6 object-contain" src="/logo.svg" />
            </div>
            <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-[#1c1b24] border border-white/20 text-white text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-[#1c1b24]">
              Pulse Home
            </span>
          </button>

          <div className="w-8 h-[1px] bg-white/10" />

          {/* WhatsApp Core Navigation Items */}
          <div className="flex flex-col items-center gap-2">
            {/* Chats */}
            <button
              onClick={() => {
                setActiveNav("chats");
              }}
              className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                activeNav === "chats"
                  ? "bg-white text-[#0d0c11] shadow-sm font-bold"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
              type="button"
            >
              {activeNav === "chats" && (
                <span className="absolute -left-3 w-1 h-5 rounded-r-full bg-white" />
              )}
              <span className="material-symbols-outlined text-xl">chat</span>
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-black font-mono text-[9px] flex items-center justify-center font-bold animate-pulse">
                  {totalUnreadCount}
                </span>
              )}
              <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-[#1c1b24] border border-white/20 text-white text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-[#1c1b24]">
                Chats
              </span>
            </button>

            {/* WhatsApp 24-Hour Status Stories */}
            <button
              onClick={() => {
                setIsStatusStoriesOpen(true);
              }}
              className="group relative flex items-center justify-center w-10 h-10 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
              type="button"
            >
              <span className="material-symbols-outlined text-xl">motion_photos_on</span>
              <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-white ring-1 ring-[#09090b]" />
              <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-[#1c1b24] border border-white/20 text-white text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-[#1c1b24]">
                Status Stories
              </span>
            </button>

            {/* Starred Messages */}
            <button
              onClick={() => {
                setIsStarredOpen(true);
              }}
              className="group relative flex items-center justify-center w-10 h-10 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
              type="button"
            >
              <span className="material-symbols-outlined text-xl">star</span>
              <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-[#1c1b24] border border-white/20 text-white text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-[#1c1b24]">
                Starred Messages
              </span>
            </button>

            {/* New Group */}
            <button
              onClick={() => {
                setIsCreateGroupOpen(true);
              }}
              className="group relative flex items-center justify-center w-10 h-10 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
              type="button"
            >
              <span className="material-symbols-outlined text-xl">group_add</span>
              <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-[#1c1b24] border border-white/20 text-white text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-[#1c1b24]">
                New Group
              </span>
            </button>

            {/* New Chat / Contacts */}
            <button
              onClick={() => {
                setActiveNav("contacts");
                setIsContactsModalOpen(true);
              }}
              className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                activeNav === "contacts"
                  ? "bg-white text-[#0d0c11] shadow-sm font-bold"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
              type="button"
            >
              {activeNav === "contacts" && (
                <span className="absolute -left-3 w-1 h-5 rounded-r-full bg-white" />
              )}
              <span className="material-symbols-outlined text-xl">person_add</span>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-black font-mono text-[9px] flex items-center justify-center font-bold animate-pulse">
                  {pendingCount}
                </span>
              )}
              <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-[#1c1b24] border border-white/20 text-white text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-[#1c1b24]">
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
            className="group relative flex items-center justify-center w-9 h-9 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
            <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-[#1c1b24] border border-white/20 text-white text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-[#1c1b24]">
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          </button>

          {/* User Profile Avatar */}
          <div
            onClick={() => setIsProfileOpen(true)}
            className="group relative cursor-pointer"
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
            <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-[#1c1b24] border border-white/20 text-white text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-[#1c1b24]">
              Profile & Settings
            </span>
          </div>
        </div>
      </nav>

      {/* 2. Zone 2: Conversation Sidebar */}
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
          onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
          onOpenStatus={() => setIsStatusStoriesOpen(true)}
          onOpenStarred={() => setIsStarredOpen(true)}
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

      {/* 3. Zone 3: Master Active Chat Workstation or WhatsApp Command Center */}
      <main
        className={`flex-1 h-full z-20 overflow-hidden flex flex-col glass-panel rounded-2xl md:rounded-3xl border border-[var(--glass-border)] border-t-[var(--glass-border-top)] shadow-glass transition-all duration-200 ${
          !selectedChat ? "hidden md:flex" : "flex"
        }`}
      >
        {selectedChat ? (
          <ChatPane onBack={() => setSelectedChat(null)} />
        ) : (
          /* WhatsApp Web Style Command Center */
          <div
            ref={commandCenterRef}
            className="home-command-center flex-1 h-full flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden select-none"
          >
            {/* 1. Pure Background Layer: Pulse waves emanate strictly from the logo coordinates into the screen background */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none">
              <div
                className="absolute pointer-events-none select-none"
                style={{
                  left: logoCoords ? `${logoCoords.x}px` : "50%",
                  top: logoCoords ? `${logoCoords.y}px` : "calc(50% - 150px)",
                }}
              >
                {/* Ultra-wide Ambient Breathing Glow */}
                <div className="absolute -top-[500px] -left-[500px] w-[1000px] h-[1000px] md:-top-[700px] md:-left-[700px] md:w-[1400px] md:h-[1400px] rounded-full bg-gradient-to-tr from-white/[0.07] via-white/[0.02] to-transparent blur-[90px] animate-home-logo-breath pointer-events-none" />
                <div className="absolute -top-[160px] -left-[160px] w-[320px] h-[320px] rounded-full bg-white/[0.08] blur-[45px] animate-pulse pointer-events-none" />

                {/* Concentric liquid-glass pulse shockwave rings originating strictly from the logo */}
                <div className="absolute -top-[240px] -left-[240px] w-[480px] h-[480px] rounded-full border border-white/30 shadow-[0_0_50px_rgba(255,255,255,0.12)] animate-home-logo-wave-1 pointer-events-none" />
                <div className="absolute -top-[240px] -left-[240px] w-[480px] h-[480px] rounded-full border border-white/20 shadow-[0_0_70px_rgba(255,255,255,0.08)] animate-home-logo-wave-2 pointer-events-none" />
                <div className="absolute -top-[240px] -left-[240px] w-[480px] h-[480px] rounded-full border border-white/12 shadow-[0_0_90px_rgba(255,255,255,0.05)] animate-home-logo-wave-3 pointer-events-none" />
              </div>
            </div>

            {/* 2. Foreground Screen: Content, cards, text, and interactive buttons */}
            <div className="relative z-10 max-w-xl w-full flex flex-col items-center text-center animate-fadeIn">
              {/* Central Glowing Hero Logo Emblem */}
              <div className="relative mb-6 flex items-center justify-center">
                <div className="absolute inset-0 rounded-3xl bg-white/20 blur-xl opacity-40 animate-pulse" />
                <div
                  ref={logoRef}
                  className="relative w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl flex items-center justify-center z-10 hover:scale-105 transition-transform"
                >
                  <img src="/logo.svg" alt="Pulse" className="w-12 h-12 object-contain" />
                </div>
              </div>

              {/* Personalized Greeting */}
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2">
                Pulse Web Messenger
              </h2>
              <p className="text-sm text-zinc-400 max-w-md mb-8">
                Send and receive messages, voice notes, photos, and documents securely.
              </p>

              {/* 4 WhatsApp Quick Launch Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-8">
                {/* 1. New Direct Chat */}
                <button
                  onClick={() => setIsAddFriendOpen(true)}
                  className="group flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 backdrop-blur-xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:scale-[1.02]"
                  type="button"
                >
                  <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform font-bold">
                    <span className="material-symbols-outlined text-lg">chat</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block truncate">New Direct Chat</span>
                    <span className="text-[11px] text-zinc-400 block truncate">Message friends & contacts</span>
                  </div>
                </button>

                {/* 2. New Group Chat */}
                <button
                  onClick={() => setIsCreateGroupOpen(true)}
                  className="group flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 backdrop-blur-xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:scale-[1.02]"
                  type="button"
                >
                  <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform font-bold">
                    <span className="material-symbols-outlined text-lg">group_add</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block truncate">New Group Chat</span>
                    <span className="text-[11px] text-zinc-400 block truncate">Create group with members</span>
                  </div>
                </button>

                {/* 3. Status Stories */}
                <button
                  onClick={() => setIsStatusStoriesOpen(true)}
                  className="group flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 backdrop-blur-xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:scale-[1.02]"
                  type="button"
                >
                  <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform font-bold">
                    <span className="material-symbols-outlined text-lg">motion_photos_on</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block truncate">Status Stories</span>
                    <span className="text-[11px] text-zinc-400 block truncate">24-hour disappearing updates</span>
                  </div>
                </button>

                {/* 4. Starred Messages */}
                <button
                  onClick={() => setIsStarredOpen(true)}
                  className="group flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 backdrop-blur-xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:scale-[1.02]"
                  type="button"
                >
                  <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform font-bold">
                    <span className="material-symbols-outlined text-lg">star</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block truncate">Starred Messages</span>
                    <span className="text-[11px] text-zinc-400 block truncate">View your saved messages</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals & Overlays */}
      {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} />}
      {isSetStatusOpen && <SetStatusModal onClose={() => setIsSetStatusOpen(false)} />}
      {isWallpaperOpen && <WallpaperModal onClose={() => setIsWallpaperOpen(false)} />}
      {isStatusStoriesOpen && <StatusModal onClose={() => setIsStatusStoriesOpen(false)} />}
      {isStarredOpen && <StarredDrawer onClose={() => setIsStarredOpen(false)} />}
      {isCreateGroupOpen && <CreateGroupModal onClose={() => setIsCreateGroupOpen(false)} />}
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
