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
  const [statusText, setStatusText] = useState(authUser?.status || "Building Liquid Glass UI");
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
    setStatusText("Online");
    setSelectedEmoji("⚡");
    setSelectedTitle("Active");
    try {
      await updateProfile({ status: "⚡ Active: Online" });
      onClose();
    } catch (err) {
      console.error("Failed to clear status:", err);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none overflow-y-auto"
    >
      <section
        onClick={(e) => e.stopPropagation()}
        className="relative overflow-hidden rounded-xl bg-surface-container/90 backdrop-blur-2xl p-6 sm:p-gutter-lg shadow-2xl border border-outline/10 text-on-surface max-w-2xl w-full animate-scaleIn my-8"
      >
        {/* Optical Specular Highlight Line inside Card */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-primary-container/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-outline/10">
          <div className="flex items-center gap-space-md">
            <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-secondary shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <span className="material-symbols-outlined">sentiment_satisfied</span>
            </div>
            <div>
              <div className="flex items-center gap-space-xs">
                <span className="text-xs">✨</span>
                <span className="font-label-caps text-[10px] uppercase text-secondary font-bold tracking-wider">Presence State</span>
              </div>
              <h3 className="font-headline-md text-headline-md font-semibold text-on-surface text-lg sm:text-xl">Set Status Mood</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-surface-container-high hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors"
            title="Close Modal"
            type="button"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Avatar Preview with Live Status Pill */}
        <div className="flex flex-wrap items-center justify-between gap-space-md p-space-md rounded-xl bg-surface-container-low/80 backdrop-blur-xl mb-4 border border-outline/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-space-md">
            <div className="relative">
              <img
                className="w-12 h-12 rounded-2xl object-cover shadow-md"
                alt="Avatar"
                src={
                  authUser?.profilePic ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.username || "User")}&background=8083ff&color=ffffff`
                }
              />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-tertiary ring-2 ring-surface-container-low" />
            </div>
            <div>
              <div className="font-title-sm text-sm font-semibold text-on-surface">{authUser?.username}</div>
              <div className="font-label-mono text-xs text-outline">{authUser?.email || "verified client"}</div>
            </div>
          </div>

          {/* Live Status Pill Preview */}
          <div className="flex items-center gap-space-sm px-space-md py-space-sm rounded-full bg-surface-variant text-on-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]">
            <span className="text-base">{selectedEmoji}</span>
            <span className="font-body-md text-xs sm:text-sm text-on-surface font-medium max-w-[160px] truncate">
              {selectedTitle}: {statusText || "Active"}
            </span>
            <span className="font-label-mono text-[10px] text-secondary font-semibold ml-space-xs">LIVE</span>
          </div>
        </div>

        {/* Custom Status Input with Character Counter */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-space-xs">
            <label className="font-label-caps text-[10px] uppercase text-on-surface-variant font-bold tracking-wider" htmlFor="custom-status">
              Custom Broadcast Status
            </label>
            <span className="font-label-mono text-xs text-secondary">{statusText.length} / 60</span>
          </div>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-base">💭</span>
            <input
              id="custom-status"
              className="w-full pl-10 pr-20 py-2.5 rounded-xl bg-surface-container-lowest/80 text-on-surface placeholder:text-outline font-body-md text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] border border-outline/10"
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
                className="absolute right-3 text-outline hover:text-on-surface text-[11px] font-label-mono uppercase tracking-wider"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* 8 Preset Mood Cards Grid (Stitch Specification) */}
        <div className="mb-6">
          <div className="font-label-caps text-[10px] uppercase text-outline mb-2 font-bold tracking-wider">
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
                  className={`text-left p-3 rounded-xl transition-all flex flex-col justify-between gap-1.5 border ${
                    isSelected
                      ? "bg-primary-container/20 text-on-surface border-primary ring-1 ring-primary shadow-lg"
                      : "bg-surface-container-low/70 hover:bg-surface-container-high/80 text-on-surface border-outline/10 shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xl p-1.5 rounded-lg bg-surface-container-highest shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                      {preset.emoji}
                    </span>
                    <span className={`material-symbols-outlined text-base ${isSelected ? "text-primary" : "text-outline"}`}>
                      {isSelected ? "check_circle" : "radio_button_unchecked"}
                    </span>
                  </div>
                  <div>
                    <div className={`font-title-sm text-xs font-semibold ${isSelected ? "text-primary" : "text-on-surface"}`}>
                      {preset.title}
                    </div>
                    <div className="font-label-mono text-[10px] text-on-surface-variant line-clamp-1">
                      {preset.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-space-md pt-4 border-t border-outline/10">
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-surface-container-high/60 text-outline hover:text-error hover:bg-error-container/20 transition-colors font-title-sm text-xs"
          >
            <span className="material-symbols-outlined text-sm">delete_sweep</span>
            <span>Clear Status</span>
          </button>

          <div className="flex items-center gap-space-sm ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-on-surface-variant hover:text-on-surface transition-colors font-title-sm text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 rounded-full bg-gradient-to-r from-primary-container via-primary to-secondary text-on-primary-container font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_8px_16px_rgba(99,102,241,0.3)] hover:opacity-90 active:scale-95 transition-all font-title-sm text-xs disabled:opacity-50"
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
