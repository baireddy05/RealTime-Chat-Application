import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";

const STATUS_PRESETS = [
  { emoji: "💻", title: "Coding", desc: "Building cool things" },
  { emoji: "🎧", title: "In the zone", desc: "Headphones on, focus" },
  { emoji: "☕", title: "Coffee break", desc: "Recharging & sipping" },
  { emoji: "🚀", title: "Shipping", desc: "Pushing to prod" },
  { emoji: "🌴", title: "AFK / Away", desc: "Stepped away briefly" },
  { emoji: "⚡", title: "Quick replies", desc: "Rapid response open" },
  { emoji: "🥪", title: "Lunch break", desc: "Grabbing some food" },
  { emoji: "😴", title: "Do Not Disturb", desc: "Notifications muted" },
];

const SetStatusModal = ({ onClose }) => {
  const { authUser, updateProfile } = useAuthStore();
  const [statusText, setStatusText] = useState(authUser?.status || "Available");
  const [selectedEmoji, setSelectedEmoji] = useState("💻");
  const [selectedTitle, setSelectedTitle] = useState("Coding");
  const [isSaving, setIsSaving] = useState(false);

  const handleSelectPreset = (preset) => {
    setSelectedEmoji(preset.emoji);
    setSelectedTitle(preset.title);
    setStatusText(preset.desc);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const fullStatus = `${selectedEmoji} ${selectedTitle}: ${statusText.trim() || "Available"}`;
      const res = await updateProfile({ status: fullStatus });
      if (res?.success) {
        onClose();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setStatusText("Available");
    setSelectedEmoji("⚡");
    setSelectedTitle("Active");
    try {
      await updateProfile({ status: "⚡ Active: Available" });
      onClose();
    } catch (err) {
      console.error("Failed to clear status:", err);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/25 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none overflow-y-auto"
    >
      <section
        onClick={(e) => e.stopPropagation()}
        className="relative overflow-hidden rounded-3xl bg-white/95 dark:bg-[#121117]/95 backdrop-blur-3xl p-6 sm:p-7 shadow-2xl border border-black/10 dark:border-white/10 text-zinc-900 dark:text-white max-w-2xl w-full animate-scaleIn my-8"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center font-bold shadow-md">
              <span className="material-symbols-outlined text-xl">sentiment_satisfied</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">✨</span>
                <span className="text-[10px] uppercase text-zinc-500 dark:text-zinc-400 font-bold tracking-wider">Presence State</span>
              </div>
              <h3 className="font-bold text-lg sm:text-xl text-zinc-900 dark:text-white tracking-tight">Set Status Mood</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            title="Close Modal"
            type="button"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Avatar Preview with Live Status Pill */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl mb-4 border border-black/10 dark:border-white/10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                className="w-12 h-12 rounded-2xl object-cover border border-black/10 dark:border-white/10 shadow-md"
                alt="Avatar"
                src={
                  authUser?.profilePic ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.username || "User")}&background=27272a&color=ffffff`
                }
              />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#121117]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">{authUser?.username}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{authUser?.email || "verified client"}</div>
            </div>
          </div>

          {/* Live Status Pill Preview */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 text-zinc-900 dark:text-white shadow-sm">
            <span className="text-base emoji-text">{selectedEmoji}</span>
            <span className="text-xs sm:text-sm text-zinc-900 dark:text-white font-medium max-w-[160px] truncate">
              {selectedTitle}: {statusText || "Available"}
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono font-bold ml-1">LIVE</span>
          </div>
        </div>

        {/* Custom Status Input with Character Counter */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-[10px] uppercase text-zinc-500 dark:text-zinc-400 font-bold tracking-wider" htmlFor="custom-status">
              Custom Broadcast Status
            </label>
            <span className="font-mono text-xs text-zinc-400">{statusText.length} / 60</span>
          </div>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-base">💭</span>
            <input
              id="custom-status"
              className="w-full pl-10 pr-20 py-2.5 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-white border border-black/10 dark:border-white/10 shadow-inner"
              maxLength={60}
              type="text"
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              placeholder="What are you working on?"
            />
            {statusText && (
              <button
                type="button"
                onClick={() => setStatusText("")}
                className="absolute right-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-[11px] font-mono uppercase tracking-wider"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* 8 Preset Mood Cards Grid */}
        <div className="mb-6">
          <div className="text-[10px] uppercase text-zinc-500 dark:text-zinc-400 mb-2 font-bold tracking-wider">
            Select Ambient Preset
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {STATUS_PRESETS.map((preset) => {
              const isSelected = selectedTitle === preset.title;
              return (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`text-left p-3 rounded-2xl transition-all flex flex-col justify-between gap-1.5 border ${
                  className={`text-left p-3 rounded-2xl transition-all flex flex-col justify-between gap-1.5 border group ${
                    isSelected
                      ? "bg-zinc-900 text-white dark:bg-white/15 dark:text-white border-zinc-900 dark:border-white/30 ring-1 ring-zinc-900/30 dark:ring-white/40 shadow-lg"
                      : "bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.07] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border-black/5 dark:border-white/10 shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-xl shadow-inner border border-black/5 dark:border-white/5 emoji-text group-hover:scale-110 transition-transform">
                      {preset.emoji}
                    </div>
                    <span className={`material-symbols-outlined text-base ${isSelected ? "text-white" : "text-zinc-400 dark:text-zinc-600"}`}>
                      {isSelected ? "check_circle" : "radio_button_unchecked"}
                    </span>
                  </div>
                  <div>
                    <div className={`text-xs font-semibold ${isSelected ? "text-white" : "text-zinc-900 dark:text-zinc-200"}`}>
                      {preset.title}
                    </div>
                    <div className={`font-mono text-[10px] ${isSelected ? "text-zinc-300 dark:text-zinc-300" : "text-zinc-500 dark:text-zinc-400"} line-clamp-1`}>
                      {preset.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-black/10 dark:border-white/10">
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/5 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 border border-black/10 dark:border-white/10 transition-colors text-xs font-medium"
          >
            <span className="material-symbols-outlined text-sm">delete_sweep</span>
            <span>Clear Status</span>
          </button>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-zinc-600 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 border border-black/10 dark:border-white/10 transition-colors text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-95 shadow-md transition-all text-xs disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Status"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SetStatusModal;
