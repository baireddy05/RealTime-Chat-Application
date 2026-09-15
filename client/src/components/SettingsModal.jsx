import { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Volume2,
  VolumeX,
  Palette,
  Bell,
  Activity,
  Sliders,
  Sun,
  Moon,
  Shield,
  Laptop,
} from "lucide-react";
import { useChatStore } from "../store/useChatStore";

const SettingsModal = ({ isOpen, onClose }) => {
  const {
    backgroundAnimationsEnabled,
    setBackgroundAnimationsEnabled,
    typingShockwavesEnabled,
    setTypingShockwavesEnabled,
    setIsChatThemeOpen,
    soundMuted,
    toggleSound,
  } = useChatStore();

  const [activeTab, setActiveTab] = useState("appearance");
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || "dark"
  );
  const [notificationsAllowed, setNotificationsAllowed] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted"
  );

  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    setTheme(currentTheme);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleTheme = (mode) => {
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem("theme", mode);
    setTheme(mode);
  };

  const handleRequestNotification = async () => {
    if (typeof Notification !== "undefined") {
      const perm = await Notification.requestPermission();
      setNotificationsAllowed(perm === "granted");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Main Modal Card */}
      <div className="relative w-full max-w-xl bg-white dark:bg-[#121118] border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh] animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex items-center justify-center font-bold shadow-sm">
              <Sliders size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white leading-tight">Settings</h2>
              <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">Manage animations, theme, and workspace preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
          <button
            onClick={() => setActiveTab("appearance")}
            className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "appearance"
                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <Sparkles size={14} />
            <span>Appearance & Animations</span>
          </button>
          <button
            onClick={() => setActiveTab("sound")}
            className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "sound"
                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <Volume2 size={14} />
            <span>Sound & Alerts</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 select-none">
          {activeTab === "appearance" && (
            <>
              {/* Section 1: Background Visual Animations */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Activity size={15} className="text-zinc-500 dark:text-zinc-400" />
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Background Animations
                  </h3>
                </div>

                <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-4 space-y-4">
                  {/* Toggle: Ambient Home Pulse Shockwaves */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5 max-w-[78%]">
                      <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <span>Ambient Logo Pulse Shockwaves</span>
                        {backgroundAnimationsEnabled && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        Radiating concentric liquid-glass shockwave rings emanating from the central logo across the home screen background.
                      </p>
                    </div>

                    {/* Switch button */}
                    <button
                      type="button"
                      onClick={() => setBackgroundAnimationsEnabled(!backgroundAnimationsEnabled)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        backgroundAnimationsEnabled ? "bg-zinc-900 dark:bg-white" : "bg-zinc-300 dark:bg-zinc-700"
                      }`}
                      title={backgroundAnimationsEnabled ? "Disable animations" : "Enable animations"}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-[#121118] shadow-lg ring-0 transition duration-200 ease-in-out ${
                          backgroundAnimationsEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="w-full h-[1px] bg-black/5 dark:bg-white/5" />

                  {/* Toggle: Keystroke Ripple Shockwaves */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5 max-w-[78%]">
                      <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <span>Interactive Keystroke Ripple Waves</span>
                        {typingShockwavesEnabled && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        Emits responsive tactile liquid ripples across the UI when typing messages in chat input fields.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setTypingShockwavesEnabled(!typingShockwavesEnabled)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        typingShockwavesEnabled ? "bg-zinc-900 dark:bg-white" : "bg-zinc-300 dark:bg-zinc-700"
                      }`}
                      title={typingShockwavesEnabled ? "Disable typing ripples" : "Enable typing ripples"}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-[#121118] shadow-lg ring-0 transition duration-200 ease-in-out ${
                          typingShockwavesEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 2: Theme Customization */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Palette size={15} className="text-zinc-500 dark:text-zinc-400" />
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Interface Theme
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleToggleTheme("light")}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
                      theme === "light"
                        ? "border-zinc-900 bg-zinc-900/5 dark:border-white dark:bg-white/10 shadow-sm"
                        : "border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 bg-black/[0.01] dark:bg-white/[0.01]"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <Sun size={17} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-white">Light Mode</div>
                      <div className="text-[11px] text-zinc-500">Crisp bright glass</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleToggleTheme("dark")}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
                      theme === "dark"
                        ? "border-zinc-900 bg-zinc-900/5 dark:border-white dark:bg-white/10 shadow-sm"
                        : "border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 bg-black/[0.01] dark:bg-white/[0.01]"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                      <Moon size={17} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-white">Dark Mode</div>
                      <div className="text-[11px] text-zinc-500">OLED Midnight Glass</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Section 3: Chat Themes & Custom Wallpapers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette size={15} className="text-zinc-500 dark:text-zinc-400" />
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                      Chat Themes & Wallpapers
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      setIsChatThemeOpen(true);
                    }}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
                  >
                    Customize Themes
                  </button>
                </div>
                <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
                  Select WhatsApp-style curated color presets, custom message bubble colors, or upload personalized chat wallpapers.
                </p>
              </div>
            </>
          )}

          {activeTab === "sound" && (
            <div className="space-y-4">
              {/* Audio Chimes */}
              <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-4 flex items-center justify-between">
                <div className="space-y-0.5 max-w-[80%]">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    {soundMuted ? <VolumeX size={15} className="text-red-400" /> : <Volume2 size={15} className="text-emerald-400" />}
                    <span>Sound Effects & Audio Chimes</span>
                  </div>
                  <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
                    Play audio cues for incoming messages, reactions, and call invites.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleSound}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    !soundMuted ? "bg-zinc-900 dark:bg-white" : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-[#121118] shadow-lg ring-0 transition duration-200 ease-in-out ${
                      !soundMuted ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Desktop Notifications */}
              <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-4 flex items-center justify-between">
                <div className="space-y-0.5 max-w-[80%]">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <Bell size={15} />
                    <span>Browser Desktop Notifications</span>
                  </div>
                  <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
                    Receive background notifications when new direct messages or mentions arrive.
                  </p>
                </div>

                {!notificationsAllowed ? (
                  <button
                    onClick={handleRequestNotification}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 active:scale-95 transition-all shadow-sm"
                  >
                    Enable
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-emerald-500">Allowed</span>
                )}
              </div>

              {/* End-to-End Encryption Banner */}
              <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                  <Shield size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-white">Encrypted Workspace Active</div>
                  <div className="text-[11px] text-zinc-500">All direct chats, calls, and voice notes are protected with client-side encryption.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-md cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
