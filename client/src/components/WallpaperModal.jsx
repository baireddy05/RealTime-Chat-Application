import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { X, Check, Image as ImageIcon, Palette } from "lucide-react";
import { WALLPAPER_PRESETS } from "../lib/wallpapers";

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
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl animate-fadeIn select-none"
    >
      <div
        className="w-full max-w-lg bg-[#121117]/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleIn text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white text-black flex items-center justify-center font-bold shadow-md">
              <Palette size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white tracking-tight">Chat Wallpaper</h3>
              <p className="text-[11px] text-zinc-400">
                {selectedChat ? `Customizing for ${selectedChat.name}` : "Global Chat Backdrop"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Preset Cards Grid */}
        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span>Atmospheric Wallpaper Presets</span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyGlobally}
                onChange={(e) => setApplyGlobally(e.target.checked)}
                className="rounded border-white/20 accent-white"
              />
              <span className="text-white text-[11px] font-medium">Apply to all chats</span>
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
                      ? "border-white ring-2 ring-white/30 bg-white/10 shadow-lg"
                      : "border-white/10 hover:border-white/30 bg-white/[0.03]"
                  }`}
                >
                  <div
                    className="absolute inset-0 opacity-40 group-hover:opacity-70 transition-opacity"
                    style={{ background: preset.previewGradient }}
                  />
                  <div className="relative z-10 flex justify-between items-start">
                    <span className="text-xs font-semibold text-white">{preset.name}</span>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center shadow font-bold">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="relative z-10 text-[11px] text-zinc-400 line-clamp-2">
                    {preset.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Custom Image URL */}
          <div className="pt-3 border-t border-white/10">
            <label className="block text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
              <ImageIcon size={14} className="text-white" />
              <span>Or Custom Image URL</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://images.unsplash.com/photo-..."
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="flex-1 bg-white/[0.04] border border-white/10 rounded-2xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-all shadow-inner"
              />
              <button
                onClick={handleCustomApply}
                disabled={!customUrl.trim()}
                className="px-5 py-2 rounded-full bg-white text-black font-bold text-xs hover:bg-zinc-200 disabled:opacity-40 transition-all shadow-md active:scale-95"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 flex justify-end bg-white/[0.02]">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-all shadow-md active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default WallpaperModal;
