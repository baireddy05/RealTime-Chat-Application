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
  Check,
  Shield,
  Lock,
} from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { ensurePushTransports } from "../lib/push";
import { hasChatPin, setChatPin, clearChatPin, verifyChatPin, getLockedChats } from "../lib/chatLock";

// Chat Lock PIN management (device-local, Privacy tab)
const ChatLockSettings = () => {
  const [pinSet, setPinSet] = useState(() => hasChatPin());
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [saving, setSaving] = useState(false);
  const lockedCount = getLockedChats().length;

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  const handleSave = async () => {
    setError("");
    setDone("");
    if (!/^\d{4}$/.test(next)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    if (next !== confirm) {
      setError("New PIN entries do not match.");
      return;
    }
    setSaving(true);
    if (pinSet) {
      const ok = await verifyChatPin(current);
      if (!ok) {
        setSaving(false);
        setError("Current PIN is incorrect.");
        return;
      }
    }
    await setChatPin(next);
    setPinSet(true);
    reset();
    setSaving(false);
    setDone(pinSet ? "PIN changed." : "PIN set. Lock chats from any chat's ⋮ menu.");
  };

  const handleRemove = async () => {
    if (!window.confirm("Remove the chat lock PIN? All locked chats will be unlocked on this device.")) return;
    clearChatPin();
    setPinSet(false);
    reset();
    setDone("PIN removed — locked chats are now open.");
  };

  const pinInput = (value, onChange, placeholder) => (
    <input
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={4}
      value={value}
      onChange={(e) => setValue(onChange, e.target.value.replace(/\D/g, "").slice(0, 4))}
      placeholder={placeholder}
      className="flex-1 min-w-0 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-center tracking-[0.5em] font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none"
    />
  );

  const setValue = (fn, v) => {
    setError("");
    setDone("");
    fn(v);
  };

  return (
    <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-3.5 sm:p-4 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Lock size={15} />
        <span className="text-xs font-bold text-zinc-900 dark:text-white">Chat Lock PIN</span>
        {pinSet && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {lockedCount > 0 ? `${lockedCount} locked` : "Active"}
          </span>
        )}
      </div>
      <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
        Lock any chat behind a 4-digit PIN on this device. Locked chats hide previews until unlocked, per session.
      </p>
      {pinSet && (
        <div className="flex items-center gap-2">
          {pinInput(current, setCurrent, "••••")}
          <span className="text-[10px] text-zinc-500 shrink-0">Current PIN</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        {pinInput(next, setNext, "••••")}
        {pinInput(confirm, setConfirm, "••••")}
        <span className="text-[10px] text-zinc-500 shrink-0">{pinSet ? "New PIN" : "New 4-digit PIN"}</span>
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      {done && <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{done}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {saving ? "Saving…" : pinSet ? "Change PIN" : "Set PIN"}
        </button>
        {pinSet && (
          <button
            type="button"
            onClick={handleRemove}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
          >
            Remove PIN
          </button>
        )}
      </div>
    </div>
  );
};
import { useThemeStore } from "../store/useThemeStore";
import { useAuthStore } from "../store/useAuthStore";
import { UI_THEMES } from "../lib/uiThemes";

const SettingsModal = ({ isOpen, onClose }) => {
  const {
    backgroundAnimationsEnabled,
    setBackgroundAnimationsEnabled,
    typingShockwavesEnabled,
    setTypingShockwavesEnabled,
    soundMuted,
    toggleSound,
  } = useChatStore();
  const { uiThemeId, setUiTheme } = useThemeStore();
  const { authUser, updateProfile } = useAuthStore();

  const [activeTab, setActiveTab] = useState("appearance");
  const [notificationsAllowed, setNotificationsAllowed] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted"
  );
  const [pushStatus, setPushStatus] = useState(null); // null | "on" | "off" | "unsupported" | "unconfigured"

  const refreshPushStatus = async () => {
    try {
      const { axiosInstance } = await import("../lib/axios");
      const { data } = await axiosInstance.get("/api/push/config");
      if (!data?.vapidPublicKey) {
        setPushStatus("unconfigured");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPushStatus("unsupported");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushStatus(sub ? "on" : "off");
    } catch {
      setPushStatus("off");
    }
  };

  useEffect(() => {
    if (isOpen) refreshPushStatus();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestNotification = async () => {    if (typeof Notification !== "undefined") {
      const perm = await Notification.requestPermission();
      setNotificationsAllowed(perm === "granted");
      if (perm === "granted") {
        await ensurePushTransports().catch(() => {});
        refreshPushStatus();
      }
    }
  };

  const handleEnablePush = async () => {
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      setNotificationsAllowed(perm === "granted");
      if (perm !== "granted") return;
    }
    await ensurePushTransports().catch(() => {});
    refreshPushStatus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[var(--modal-backdrop)] backdrop-blur-md animate-fadeIn">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Main Modal Card — bottom sheet on mobile, centered dialog on desktop */}
      <div className="relative w-full sm:max-w-xl bg-white dark:bg-[#121118] border border-black/10 dark:border-white/10 rounded-t-3xl sm:rounded-3xl rounded-b-none sm:rounded-b-3xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh] animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex items-center justify-center font-bold shadow-sm shrink-0">
              <Sliders size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white leading-tight">Settings</h2>
              <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 truncate">Manage animations, theme, and preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation — horizontally scrollable on mobile */}
        <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 pt-3 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab("appearance")}
            className={`flex items-center gap-1.5 pb-2.5 px-2 text-[11px] sm:text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === "appearance"
                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <Sparkles size={14} className="shrink-0" />
            <span>Appearance</span>
          </button>
          <button
            onClick={() => setActiveTab("sound")}
            className={`flex items-center gap-1.5 pb-2.5 px-2 text-[11px] sm:text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === "sound"
                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <Volume2 size={14} className="shrink-0" />
            <span>Sound & Alerts</span>
          </button>
          <button
            onClick={() => setActiveTab("privacy")}
            className={`flex items-center gap-1.5 pb-2.5 px-2 text-[11px] sm:text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === "privacy"
                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <Lock size={14} className="shrink-0" />
            <span>Privacy</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 select-none">
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

                <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-3.5 sm:p-4 space-y-4">
                  {/* Toggle: Ambient Home Pulse Shockwaves */}
                  <div className="flex items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="space-y-0.5 min-w-0 flex-1">
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
                  <div className="flex items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="space-y-0.5 min-w-0 flex-1">
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

              {/* Section 2: Whole-App UI Themes */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Palette size={15} className="text-zinc-500 dark:text-zinc-400" />
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    App Theme
                  </h3>
                </div>

                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5 sm:gap-3">
                  {UI_THEMES.map((t) => {
                    const isActive = uiThemeId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setUiTheme(t.id)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left cursor-pointer active:scale-[0.98] ${
                          isActive
                            ? "border-accent-primary bg-accent-primary/10 shadow-sm ring-1 ring-accent-primary/40"
                            : "border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 bg-black/[0.01] dark:bg-white/[0.01]"
                        }`}
                      >
                        <span
                          className="w-10 h-10 rounded-xl shrink-0 border border-black/10 dark:border-white/10 shadow-inner"
                          style={{ background: t.preview }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                            {t.name}
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                              {t.scheme}
                            </span>
                          </span>
                          <span className="text-[11px] text-zinc-500 block truncate">{t.tagline}</span>
                        </span>
                        <span
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                            isActive
                              ? "border-accent-primary bg-accent-primary text-white"
                              : "border-black/15 dark:border-white/15"
                          }`}
                        >
                          {isActive && <Check size={12} strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
                  Applies instantly across chats, calls, and menus on this device.
                </p>
              </div>
            </>
          )}

          {activeTab === "sound" && (
            <div className="space-y-4">
              {/* Audio Chimes */}
              <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-3.5 sm:p-4 flex items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0 flex-1">
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
              <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-3.5 sm:p-4 flex items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0 flex-1">
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

              {/* Background Push (phone-off / app-closed notifications) */}
              <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-3.5 sm:p-4 flex items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <Bell size={15} />
                    <span>Background Push Notifications</span>
                  </div>
                  <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
                    Get message and call alerts even when the browser tab is closed.
                  </p>
                  {pushStatus === "unconfigured" && (
                    <p className="text-[11px] text-amber-500">
                      Server push is not configured yet (missing VAPID keys).
                    </p>
                  )}
                  {pushStatus === "unsupported" && (
                    <p className="text-[11px] text-amber-500">
                      This browser does not support background push.
                    </p>
                  )}
                </div>

                {pushStatus === "on" ? (
                  <span className="text-xs font-semibold text-emerald-500 shrink-0">On</span>
                ) : (
                  <button
                    onClick={handleEnablePush}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 active:scale-95 transition-all shadow-sm shrink-0"
                  >
                    Enable
                  </button>
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

          {activeTab === "privacy" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-3.5 sm:p-4 flex items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <Lock size={15} />
                    <span>Read Receipts (Blue Ticks)</span>
                  </div>
                  <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
                    If turned off, you won't send or receive read receipts. Read receipts are always sent for group chats.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => updateProfile({ readReceipts: authUser?.readReceipts === false ? true : false })}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    authUser?.readReceipts !== false ? "bg-zinc-900 dark:bg-white" : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                  title={authUser?.readReceipts !== false ? "Disable read receipts" : "Enable read receipts"}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-[#121118] shadow-lg ring-0 transition duration-200 ease-in-out ${
                      authUser?.readReceipts !== false ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <ChatLockSettings />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 sm:px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:pb-3.5 border-t border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] shrink-0">
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
