import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import ChatPane from "../components/ChatPane";
import ProfileModal from "../components/ProfileModal";
import CallModal from "../components/CallModal";
import IncomingCallModal from "../components/IncomingCallModal";
import SetStatusModal from "../components/SetStatusModal";
import ChatThemeModal from "../components/ChatThemeModal";
import AddFriendModal from "../components/AddFriendModal";
import StatusModal from "../components/StatusModal";
import StarredDrawer from "../components/StarredDrawer";
import CreateGroupModal from "../components/CreateGroupModal";
import SettingsModal from "../components/SettingsModal";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useCallStore } from "../store/useCallStore";
import { useFriendStore } from "../store/useFriendStore";
import { useThemeStore } from "../store/useThemeStore";
import { usePWAInstall } from "../hooks/usePWAInstall";
import TypingPulseBackground from "../components/TypingPulseBackground";
import { useBackHandler, backManager } from "../lib/backNavigation";

const HomePage = () => {
  const {
    selectedChat,
    setSelectedChat,
    rooms,
    getRooms,
    isChatThemeOpen,
    setIsChatThemeOpen,
    unreadCounts,
    isStarredOpen,
    setIsStarredOpen,
    subscribeToMessages,
    networkStatuses,
    isSettingsOpen,
    setIsSettingsOpen,
    backgroundAnimationsEnabled,
    typingShockwavesEnabled,
  } = useChatStore();
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

  // Initialize mobile root back-navigation guard
  useEffect(() => {
    backManager.ensureRootGuard();
  }, []);

  // Mobile Back Navigation handlers: Intercept phone back button/gestures
  useBackHandler(!!selectedChat, () => setSelectedChat(null), "home-chat-view");
  useBackHandler(isProfileOpen, () => setIsProfileOpen(false), "home-modal-profile");
  useBackHandler(isSetStatusOpen, () => setIsSetStatusOpen(false), "home-modal-status");
  useBackHandler(
    isAddFriendOpen || isContactsModalOpen,
    () => {
      setIsAddFriendOpen(false);
      setIsContactsModalOpen(false);
    },
    "home-modal-contacts"
  );
  useBackHandler(isStatusStoriesOpen, () => setIsStatusStoriesOpen(false), "home-modal-stories");
  useBackHandler(isCreateGroupOpen, () => setIsCreateGroupOpen(false), "home-modal-create-group");
  useBackHandler(isStarredOpen, () => setIsStarredOpen(false), "home-modal-starred");
  useBackHandler(isChatThemeOpen, () => setIsChatThemeOpen(false), "home-modal-chat-theme");
  useBackHandler(isSettingsOpen, () => setIsSettingsOpen(false), "home-modal-settings");

  // Logo screen coordinate tracking for full UI background pulse waves
  const logoRef = useRef(null);
  const [logoCoords, setLogoCoords] = useState(null);

  // Draggable Resizable Sidebar
  const sidebarContainerRef = useRef(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = localStorage.getItem("pulse_sidebar_width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 310 && parsed <= 700) return parsed;
      }
    } catch (e) {}
    return 360;
  });
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const resetSidebarWidth = useCallback(() => {
    setSidebarWidth(360);
    try {
      localStorage.setItem("pulse_sidebar_width", "360");
    } catch (e) {}
  }, []);

  const updateLogoCoords = useCallback(() => {
    if (logoRef.current) {
      const lRect = logoRef.current.getBoundingClientRect();
      if (lRect.width > 0 && lRect.height > 0) {
        setLogoCoords({
          x: lRect.left + lRect.width / 2,
          y: lRect.top + lRect.height / 2,
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      if (clientX === undefined) return;

      let railOffset = 76;
      if (sidebarContainerRef.current) {
        railOffset = sidebarContainerRef.current.getBoundingClientRect().left;
      }

      let newWidth = clientX - railOffset;
      const minWidth = 310;
      const maxWidth = Math.max(minWidth, Math.min(680, window.innerWidth - 360));

      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;

      setSidebarWidth(newWidth);
      try {
        localStorage.setItem("pulse_sidebar_width", newWidth.toString());
      } catch (err) {}

      // Keep background pulse wave anchored strictly to the logo in real time
      if (logoRef.current) {
        const lRect = logoRef.current.getBoundingClientRect();
        if (lRect.width > 0) {
          setLogoCoords({
            x: lRect.left + lRect.width / 2,
            y: lRect.top + lRect.height / 2,
          });
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleMouseMove);
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // Keep sidebar within bounds when window resizes
  useEffect(() => {
    const handleWindowResize = () => {
      if (typeof window !== "undefined" && window.innerWidth >= 768) {
        const maxWidth = Math.max(310, Math.min(680, window.innerWidth - 360));
        setSidebarWidth((prev) => (prev > maxWidth ? maxWidth : prev));
      }
    };
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  // Recalculate logo coordinates whenever chat state, sidebar width, or window changes
  useEffect(() => {
    updateLogoCoords();
    const timer = setTimeout(updateLogoCoords, 60);
    window.addEventListener("resize", updateLogoCoords);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateLogoCoords);
    };
  }, [selectedChat, sidebarWidth, updateLogoCoords]);

  // Use ResizeObserver for accurate tracking of the central hero logo
  useEffect(() => {
    if (!logoRef.current) return;
    const ro = new ResizeObserver(() => {
      updateLogoCoords();
    });
    ro.observe(logoRef.current);
    return () => ro.disconnect();
  }, [selectedChat, updateLogoCoords]);

  // Global real-time messaging and WebRTC calling listeners
  useEffect(() => {
    if (socket && authUser) {
      initSocketListeners(socket, authUser);
      subscribeToMessages();
    }
  }, [socket, authUser, initSocketListeners, subscribeToMessages]);

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
  
  // Calculate unread chats (ignoring hidden rooms)
  const unreadChatsCount = useMemo(() => {
    let count = 0;
    const validRooms = (rooms || []).filter((r) => {
      const name = (r.name || "").toLowerCase().trim();
      return name !== "#announcements" && name !== "announcements" && name !== "#dev-hangout" && name !== "dev-hangout";
    });
    
    validRooms.forEach((r) => {
      if ((unreadCounts?.[r._id] || 0) > 0) count++;
    });
    
    (friends || []).forEach((f) => {
      if ((unreadCounts?.[f._id] || 0) > 0) count++;
    });
    
    return count;
  }, [rooms, friends, unreadCounts]);

  const [hasUnreadStories, setHasUnreadStories] = useState(false);
  useEffect(() => {
    const handleStoryViewed = () => {
      try {
        const viewed = JSON.parse(localStorage.getItem("viewedStories") || "[]");
        const hasUnread = (networkStatuses || []).some(person => 
          person.stories.some(story => !viewed.includes(story.id))
        );
        setHasUnreadStories(hasUnread);
      } catch (e) {
        setHasUnreadStories(false);
      }
    };
    
    handleStoryViewed(); // Initial check
    window.addEventListener("pulse:story-viewed", handleStoryViewed);
    return () => window.removeEventListener("pulse:story-viewed", handleStoryViewed);
  }, [networkStatuses]);

  const handleInstallPWA = async () => {
    if (isInstallable) {
      await promptInstall();
    } else {
      alert("Pulse Messenger is ready! You can install it via your browser menu (Add to Home Screen or Install App).");
    }
  };

  return (
    <>
      <div
        className="h-[100dvh] w-screen overflow-hidden flex flex-row p-0 sm:p-2 md:p-3 gap-0 sm:gap-2 md:gap-3 bg-transparent text-on-surface antialiased select-none relative font-sans transition-colors duration-200 safe-top"
        style={{
          "--sidebar-width": `${sidebarWidth}px`,
        }}
      >
      {/* 1. Dynamic Liquid Glass Pulse Shockwave Background */}
      {backgroundAnimationsEnabled && typingShockwavesEnabled && <TypingPulseBackground />}

      {/* Full UI Background Pulse: Originates strictly from Home Logo across the entire window (Desktop only) */}
      {!selectedChat && backgroundAnimationsEnabled && (
        <div className="hidden md:block fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
          <div
            className={`absolute pointer-events-none select-none ${
              isResizing ? "transition-none" : "transition-all duration-300"
            }`}
            style={{
              left: logoCoords ? `${logoCoords.x}px` : "65vw",
              top: logoCoords ? `${logoCoords.y}px` : "33vh",
              opacity: logoCoords ? 1 : 0,
            }}
          >
            {/* Ultra-wide Ambient Breathing Glow across the entire UI */}
            <div className="absolute -top-[750px] -left-[750px] w-[1500px] h-[1500px] rounded-full bg-gradient-to-tr from-black/[0.03] via-black/[0.01] to-transparent dark:from-white/[0.08] dark:via-white/[0.02] dark:to-transparent blur-[120px] animate-home-logo-breath pointer-events-none" />
            <div className="absolute -top-[200px] -left-[200px] w-[400px] h-[400px] rounded-full bg-black/[0.03] dark:bg-white/[0.10] blur-[60px] animate-pulse pointer-events-none" />

            {/* Concentric liquid-glass pulse shockwave rings radiating from the logo across the entire window */}
            <div className="absolute -top-[300px] -left-[300px] w-[600px] h-[600px] rounded-full border-2 border-zinc-900/20 dark:border-white/35 shadow-[0_0_60px_rgba(0,0,0,0.06)] dark:shadow-[0_0_60px_rgba(255,255,255,0.15)] animate-home-logo-wave-1 pointer-events-none" />
            <div className="absolute -top-[300px] -left-[300px] w-[600px] h-[600px] rounded-full border border-zinc-900/15 dark:border-white/25 shadow-[0_0_80px_rgba(0,0,0,0.04)] dark:shadow-[0_0_80px_rgba(255,255,255,0.10)] animate-home-logo-wave-2 pointer-events-none" />
            <div className="absolute -top-[300px] -left-[300px] w-[600px] h-[600px] rounded-full border border-zinc-900/10 dark:border-white/15 shadow-[0_0_100px_rgba(0,0,0,0.02)] dark:shadow-[0_0_100px_rgba(255,255,255,0.06)] animate-home-logo-wave-3 pointer-events-none" />
          </div>
        </div>
      )}

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
              className="group relative flex items-center justify-center w-12 h-12 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              type="button"
            >
              <img alt="Pulse Logo" className="w-11 h-11 object-contain drop-shadow-sm transition-transform group-hover:scale-110" src="/logo.png" />
            <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-[#1c1b24] dark:text-white border border-zinc-700/40 dark:border-white/20 text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-zinc-900 dark:before:border-r-[#1c1b24]">
              Pulse Home
            </span>
          </button>

          <div className="w-8 h-[1px] bg-black/10 dark:bg-white/10" />

          {/* Core Navigation Items */}
          <div className="flex flex-col items-center gap-2">
            {/* Chats */}
            <button
              onClick={() => {
                setActiveNav("chats");
              }}
              className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                activeNav === "chats"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-sm font-bold"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5"
              }`}
              type="button"
            >
              {activeNav === "chats" && (
                <span className="absolute -left-3 w-1 h-5 rounded-r-full bg-zinc-900 dark:bg-white" />
              )}
              <span className="material-symbols-outlined text-xl">chat</span>
              {unreadChatsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black font-mono text-[9px] flex items-center justify-center font-bold animate-pulse">
                  {unreadChatsCount}
                </span>
              )}
              <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-[#1c1b24] dark:text-white border border-zinc-700/40 dark:border-white/20 text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-zinc-900 dark:before:border-r-[#1c1b24]">
                Chats
              </span>
            </button>

            {/* 24-Hour Status Stories */}
            <button
              onClick={() => {
                setIsStatusStoriesOpen(true);
              }}
              className="group relative flex items-center justify-center w-10 h-10 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5 transition-all"
              type="button"
            >
              <span className="material-symbols-outlined text-xl">motion_photos_on</span>
              {hasUnreadStories && (
                <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-500 dark:bg-white ring-1 ring-white dark:ring-[#09090b]" />
              )}
              <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-[#1c1b24] dark:text-white border border-zinc-700/40 dark:border-white/20 text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-zinc-900 dark:before:border-r-[#1c1b24]">
                Status Stories
              </span>
            </button>

            {/* Starred Messages */}
            <button
              onClick={() => {
                setIsStarredOpen(true);
              }}
              className="group relative flex items-center justify-center w-10 h-10 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5 transition-all"
              type="button"
            >
              <span className="material-symbols-outlined text-xl">star</span>
              <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-[#1c1b24] dark:text-white border border-zinc-700/40 dark:border-white/20 text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-zinc-900 dark:before:border-r-[#1c1b24]">
                Starred Messages
              </span>
            </button>

            {/* New Group */}
            <button
              onClick={() => {
                setIsCreateGroupOpen(true);
              }}
              className="group relative flex items-center justify-center w-10 h-10 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5 transition-all"
              type="button"
            >
              <span className="material-symbols-outlined text-xl">group_add</span>
              <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-[#1c1b24] dark:text-white border border-zinc-700/40 dark:border-white/20 text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-zinc-900 dark:before:border-r-[#1c1b24]">
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
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-sm font-bold"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5"
              }`}
              type="button"
            >
              {activeNav === "contacts" && (
                <span className="absolute -left-3 w-1 h-5 rounded-r-full bg-zinc-900 dark:bg-white" />
              )}
              <span className="material-symbols-outlined text-xl">person_add</span>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black font-mono text-[9px] flex items-center justify-center font-bold animate-pulse">
                  {pendingCount}
                </span>
              )}
              <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-[#1c1b24] dark:text-white border border-zinc-700/40 dark:border-white/20 text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-zinc-900 dark:before:border-r-[#1c1b24]">
                Contacts ({friends?.length || 0})
              </span>
            </button>
          </div>
        </div>

        {/* Bottom Stack: Settings, Theme, Profile */}
        <div className="flex flex-col items-center gap-3">
          {/* Settings Modal Toggle */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="group relative flex items-center justify-center w-9 h-9 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Settings"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">settings</span>
            <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-[#1c1b24] dark:text-white border border-zinc-700/40 dark:border-white/20 text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-zinc-900 dark:before:border-r-[#1c1b24]">
              Settings
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="group relative flex items-center justify-center w-9 h-9 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
            <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-[#1c1b24] dark:text-white border border-zinc-700/40 dark:border-white/20 text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-zinc-900 dark:before:border-r-[#1c1b24]">
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          </button>

          {/* User Profile Avatar */}
          <div
            onClick={() => setIsProfileOpen(true)}
            className="group relative cursor-pointer"
          >
            <div className="relative w-9 h-9 rounded-full overflow-hidden border border-black/10 dark:border-white/15 hover:scale-105 active:scale-95 transition-transform shadow-sm">
              <img
                alt={authUser?.username || "Profile"}
                className="w-full h-full rounded-full object-cover"
                src={
                  authUser?.profilePic ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    authUser?.username || "User"
                  )}&background=27272a&color=ffffff&bold=true`
                }
              />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#100f15] z-10" />
            <div className="absolute left-full ml-3 px-3 py-2 rounded-xl bg-zinc-900 text-white dark:bg-[#1c1b24] dark:text-white border border-zinc-700/40 dark:border-white/20 text-xs shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 scale-95 group-hover:scale-100 whitespace-nowrap z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-zinc-900 dark:before:border-r-[#1c1b24]">
              <div className="font-semibold text-white">{authUser?.username || "Profile"}</div>
              <div className="text-[11px] text-zinc-300 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                <span>{statusEmoji}</span>
                <span>{statusCategory}: {statusDetail}</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* 2. Zone 2: Conversation Sidebar */}
      <div
        ref={sidebarContainerRef}
        style={{
          width: typeof window !== "undefined" && window.innerWidth >= 768 ? `${sidebarWidth}px` : undefined,
        }}
        className={`w-full md:w-[var(--sidebar-width)] h-full z-30 shrink-0 flex flex-col glass-panel sm:rounded-2xl md:rounded-3xl border-x-0 sm:border-x border-y-0 sm:border-y border-[var(--glass-border)] sm:border-t-[var(--glass-border-top)] shadow-none sm:shadow-glass overflow-hidden ${
          isResizing ? "transition-none select-none pointer-events-none" : "transition-[width] duration-75 ease-out"
        } ${selectedChat ? "hidden md:flex" : "flex"}`}
      >
        <Sidebar
          onChatSelect={() => {}}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenSetStatus={() => setIsProfileOpen(true)}
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
        />
      </div>

      {/* Draggable Resizer Separator (Desktop only) */}
      <div
        onMouseDown={startResizing}
        onTouchStart={startResizing}
        onDoubleClick={resetSidebarWidth}
        title="Drag to resize sidebar • Double-click to reset"
        className="hidden md:flex relative items-center justify-center w-0 shrink-0 z-40 select-none group cursor-col-resize h-full"
      >
        {/* Full-height hit area with hover indicator */}
        <div className="absolute -left-2.5 -right-2.5 top-0 bottom-0 cursor-col-resize flex items-center justify-center">
          {/* Visual Vertical Grip Line / Pill */}
          <div
            className={`w-1 rounded-full transition-all duration-200 ${
              isResizing
                ? "bg-zinc-900 dark:bg-white h-24 shadow-[0_0_12px_rgba(0,0,0,0.3)] dark:shadow-[0_0_12px_rgba(255,255,255,0.5)] scale-125"
                : "bg-transparent group-hover:bg-zinc-400/60 dark:group-hover:bg-white/50 h-14 group-hover:h-20"
            }`}
          />
        </div>
      </div>

      {/* 3. Zone 3: Master Active Chat Workstation or Command Center */}
      <main
        className={`flex-1 min-w-0 h-full z-20 overflow-hidden flex flex-col glass-panel sm:rounded-2xl md:rounded-3xl border-x-0 sm:border-x border-y-0 sm:border-y border-[var(--glass-border)] sm:border-t-[var(--glass-border-top)] shadow-none sm:shadow-glass transition-all duration-200 ${
          !selectedChat ? "hidden md:flex" : "flex"
        }`}
      >
        {selectedChat ? (
          <ChatPane onBack={() => setSelectedChat(null)} />
        ) : (
          /* Web Style Command Center */
          <div className="flex-1 h-full flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden select-none">
            {/* Foreground Content: Central Logo, greeting, and quick launch cards */}
            <div className="relative z-10 max-w-xl w-full flex flex-col items-center text-center animate-fadeIn">
              {/* Central Glowing Hero Logo Emblem */}
              <div className="relative mb-6 flex items-center justify-center">
                <div className="absolute inset-0 rounded-3xl bg-cyan-500/20 dark:bg-cyan-400/30 blur-2xl opacity-60 animate-pulse" />
                  <div ref={logoRef} className="relative w-28 h-28 flex items-center justify-center z-10 hover:scale-105 transition-transform">
                    <img src="/logo.png" alt="Pulse" className="w-full h-full object-contain drop-shadow-[0_4px_16px_rgba(0,240,255,0.3)]" />
                  </div>
              </div>

              {/* Personalized Greeting */}
              <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">
                Pulse Web Messenger
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mb-8">
                Send and receive messages, voice notes, photos, and documents securely.
              </p>

              {/* 4 Quick Launch Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-8">
                {/* 1. New Direct Chat */}
                <button
                  onClick={() => setIsAddFriendOpen(true)}
                  className="group flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/70 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 border border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20 backdrop-blur-xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:scale-[1.02]"
                  type="button"
                >
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform font-bold">
                    <span className="material-symbols-outlined text-lg">chat</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white block truncate">New Direct Chat</span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate">Message friends & contacts</span>
                  </div>
                </button>

                {/* 2. New Group Chat */}
                <button
                  onClick={() => setIsCreateGroupOpen(true)}
                  className="group flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/70 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 border border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20 backdrop-blur-xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:scale-[1.02]"
                  type="button"
                >
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform font-bold">
                    <span className="material-symbols-outlined text-lg">group_add</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white block truncate">New Group Chat</span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate">Create group with members</span>
                  </div>
                </button>

                {/* 3. Status Stories */}
                <button
                  onClick={() => setIsStatusStoriesOpen(true)}
                  className="group flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/70 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 border border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20 backdrop-blur-xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:scale-[1.02]"
                  type="button"
                >
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform font-bold">
                    <span className="material-symbols-outlined text-lg">motion_photos_on</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white block truncate">Status Stories</span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate">24-hour disappearing updates</span>
                  </div>
                </button>

                {/* 4. Starred Messages */}
                <button
                  onClick={() => setIsStarredOpen(true)}
                  className="group flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/70 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 border border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20 backdrop-blur-xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:scale-[1.02]"
                  type="button"
                >
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform font-bold">
                    <span className="material-symbols-outlined text-lg">star</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white block truncate">Starred Messages</span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate">View your saved messages</span>
                  </div>
                </button>
              </div>

              {/* Creator Credits */}
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 select-none">
                <span>Created by</span>
                <span className="font-semibold text-zinc-600 dark:text-zinc-300">Byreddy Rithwik Reddy</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>

    {/* Modals & Overlays - Rendered outside the flex row layout */}
    {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} />}
    {isSetStatusOpen && <SetStatusModal onClose={() => setIsSetStatusOpen(false)} />}
    {isChatThemeOpen && <ChatThemeModal isOpen={isChatThemeOpen} onClose={() => setIsChatThemeOpen(false)} />}
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
    {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />}

    {/* WebRTC Video & Audio Call Overlays */}
    <CallModal />
    <IncomingCallModal />

    {/* Global Drag Overlay during split pane resizing */}
    {isResizing && (
      <div className="fixed inset-0 z-[100] cursor-col-resize select-none pointer-events-auto bg-transparent" />
    )}
  </>
);
};

export default HomePage;


