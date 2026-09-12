import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { X, Check, Image as ImageIcon, Sparkles, Palette } from "lucide-react";

export const WALLPAPER_PRESETS = [
  {
    id: "default",
    name: "Pure Liquid Glass",
    description: "Adaptive glass theme matching active system mode",
    bgClass: "bg-transparent",
    previewGradient: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(168,85,247,0.15))",
  },
  {
    id: "midnight-aurora",
    name: "Midnight Aurora",
    description: "Deep celestial emerald and electric teal waves",
    bgClass: "bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-900/30 via-slate-950/70 to-emerald-950/40",
    previewGradient: "linear-gradient(135deg, #0d9488, #064e3b, #022c22)",
  },
  {
    id: "cyber-neon",
    name: "Cyber Neon",
    description: "Vibrant violet, magenta and cybernetic indigo glow",
    bgClass: "bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-fuchsia-950/40 via-purple-950/70 to-indigo-950/50",
    previewGradient: "linear-gradient(135deg, #c026d3, #7e22ce, #3b0764)",
  },
  {
    id: "sunset-rose",
    name: "Sunset Rose",
    description: "Warm golden-hour amber blending into frosted crimson",
    bgClass: "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-950/35 via-orange-950/40 to-slate-950/60",
    previewGradient: "linear-gradient(135deg, #f43f5e, #ea580c, #7c2d12)",
  },
  {
    id: "deep-abyss",
    name: "Deep Abyss",
    description: "Infinite oceanic midnight navy with sapphire shimmer",
    bgClass: "bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-950/45 via-sky-950/30 to-slate-950/70",
    previewGradient: "linear-gradient(135deg, #1d4ed8, #0369a1, #0f172a)",
  },
  {
    id: "cosmic-matrix",
    name: "Cosmic Matrix",
    description: "Subtle holographic lime & charcoal matrix aura",
    bgClass: "bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-900/25 via-zinc-950/80 to-slate-950/90",
    previewGradient: "linear-gradient(135deg, #10b981, #065f46, #09090b)",
  },
];

const WallpaperModal = ({ isOpen, onClose }) => {
  const { selectedChat, chatWallpapers, setChatWallpaper, globalWallpaper, setGlobalWallpaper } = useChatStore();
  const currentChatId = selectedChat?.id || "global";
  const activeWallpaper = chatWallpapers[currentChatId] || globalWallpaper || "default";

  const [applyGlobally, setApplyGlobally] = useState(false);
  const [customUrl, setCustomUrl] = useState(
    activeWallpaper.startsWith("http") ? activeWallpaper : ""
  );

  if (!isOpen) return null;

  const handleSelect = (wallpaperId) => {
    if (applyGlobally) {
      setGlobalWallpaper(wallpaperId);
    } else if (selectedChat?.id) {
      setChatWallpaper(selectedChat.id, wallpaperId);
    } else {
      setGlobalWallpaper(wallpaperId);
    }
  };

  const handleCustomApply = () => {
    if (!customUrl.trim()) return;
    handleSelect(customUrl.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-lg bg-[var(--glass-heavy)] border border-[var(--glass-border)] rounded-3xl shadow-glass overflow-hidden flex flex-col max-h-[85vh] animate-scaleIn smooth-gpu"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
              <Palette size={18} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-theme-main">Chat Wallpaper</h3>
              <p className="text-[12px] text-theme-muted">
                {selectedChat ? `Customizing for ${selectedChat.name}` : "Global Chat Backdrop"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--glass-hover)] text-theme-muted hover:text-theme-main transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Preset Cards Grid */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between text-[12px] text-theme-muted mb-1">
            <span>Liquid Glass Gradient Presets</span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyGlobally}
                onChange={(e) => setApplyGlobally(e.target.checked)}
                className="rounded border-[var(--glass-border)] accent-accent-primary"
              />
              <span className="text-theme-main text-[11px] font-medium">Apply to all chats</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {WALLPAPER_PRESETS.map((preset) => {
              const isSelected = activeWallpaper === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => handleSelect(preset.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between h-28 relative overflow-hidden group active:scale-[0.98] ${
                    isSelected
                      ? "border-accent-primary ring-2 ring-accent-primary/30 bg-accent-primary/10 shadow-lg"
                      : "border-[var(--glass-border)] hover:border-accent-primary/50 bg-[var(--glass-surface)]"
                  }`}
                >
                  <div
                    className="absolute inset-0 opacity-40 group-hover:opacity-70 transition-opacity"
                    style={{ background: preset.previewGradient }}
                  />
                  <div className="relative z-10 flex justify-between items-start">
                    <span className="text-[13px] font-semibold text-theme-main">{preset.name}</span>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-accent-primary text-white flex items-center justify-center shadow">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="relative z-10 text-[11px] text-theme-muted/80 line-clamp-2">
                    {preset.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Custom Image URL */}
          <div className="pt-2 border-t border-[var(--glass-border)]">
            <label className="block text-[12px] font-medium text-theme-main mb-1.5 flex items-center gap-1.5">
              <ImageIcon size={13} className="text-accent-primary" />
              <span>Or Custom Background Image URL</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://images.unsplash.com/photo-..."
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="flex-1 glass-input rounded-xl px-3.5 py-2 text-[12px] text-theme-main border border-[var(--glass-border)] focus:outline-none focus:border-accent-primary transition-all"
              />
              <button
                onClick={handleCustomApply}
                disabled={!customUrl.trim()}
                className="px-4 py-2 rounded-xl bg-accent-primary text-white text-[12px] font-medium hover:bg-accent-primary/90 disabled:opacity-50 transition-all"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--glass-border)] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-accent-primary text-white text-[13px] font-medium hover:bg-accent-primary/90 transition-all shadow-md active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default WallpaperModal;
