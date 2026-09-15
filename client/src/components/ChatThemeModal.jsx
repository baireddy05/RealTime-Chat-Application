import { useState, useRef, useEffect } from "react";
import {
  X,
  Check,
  Palette,
  Image as ImageIcon,
  Upload,
  Sparkles,
  Sliders,
  RotateCcw,
  CheckCheck,
  Lock,
  Mic,
  Smile,
  Layers,
} from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import {
  CHAT_THEME_PRESETS,
  CHAT_DOODLE_SVG,
  getThemeById,
  resolveThemeStyles,
} from "../lib/chatThemes";

const CURATED_WALLPAPERS = [
  {
    id: "nature-aurora",
    name: "Nordic Lights",
    url: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1000&auto=format&fit=crop&q=80",
    thumb: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=160&auto=format&fit=crop&q=60",
  },
  {
    id: "mountain-mist",
    name: "Foggy Peaks",
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1000&auto=format&fit=crop&q=80",
    thumb: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=160&auto=format&fit=crop&q=60",
  },
  {
    id: "cyber-city",
    name: "Cyber Tokyo",
    url: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1000&auto=format&fit=crop&q=80",
    thumb: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=160&auto=format&fit=crop&q=60",
  },
  {
    id: "desert-dunes",
    name: "Sahara Sunset",
    url: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=1000&auto=format&fit=crop&q=80",
    thumb: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=160&auto=format&fit=crop&q=60",
  },
  {
    id: "abstract-glass",
    name: "Prism Waves",
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80",
    thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=160&auto=format&fit=crop&q=60",
  },
  {
    id: "deep-space",
    name: "Cosmic Nebula",
    url: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1000&auto=format&fit=crop&q=80",
    thumb: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=160&auto=format&fit=crop&q=60",
  },
];

const CUSTOM_BUBBLE_GRADIENTS = [
  { id: "emerald", name: "Emerald Glow", gradient: "linear-gradient(135deg, #005c4b, #008069)" },
  { id: "navy", name: "Royal Blue", gradient: "linear-gradient(135deg, #1d4ed8, #2563eb)" },
  { id: "purple", name: "Deep Violet", gradient: "linear-gradient(135deg, #6d28d9, #7c3aed)" },
  { id: "rose", name: "Crimson Rose", gradient: "linear-gradient(135deg, #be123c, #e11d48)" },
  { id: "amber", name: "Sunset Orange", gradient: "linear-gradient(135deg, #c2410c, #ea580c)" },
  { id: "cyan", name: "Electric Cyan", gradient: "linear-gradient(135deg, #0891b2, #06b6d4)" },
  { id: "teal", name: "Forest Teal", gradient: "linear-gradient(135deg, #0f766e, #14b8a6)" },
  { id: "mono", name: "Charcoal Slate", gradient: "linear-gradient(135deg, #27272a, #3f3f46)" },
];

const ChatThemeModal = ({ isOpen, onClose }) => {
  const {
    selectedChat,
    chatThemes,
    globalChatTheme,
    setChatTheme,
    setGlobalChatTheme,
  } = useChatStore();

  const chatId = selectedChat?.id || "global";
  const initialTheme = chatThemes[chatId] || globalChatTheme || "default";

  // Active theme editing state
  const [activePresetId, setActivePresetId] = useState(() =>
    typeof initialTheme === "string" ? initialTheme : initialTheme?.presetId || "default"
  );
  const [customWallpaper, setCustomWallpaper] = useState(() =>
    typeof initialTheme === "object" ? initialTheme?.customWallpaperUrl || null : null
  );
  const [customBubbleColor, setCustomBubbleColor] = useState(() =>
    typeof initialTheme === "object" ? initialTheme?.customBubbleColor || null : null
  );
  const [wallpaperOpacity, setWallpaperOpacity] = useState(() =>
    typeof initialTheme === "object" ? initialTheme?.wallpaperOpacity ?? 0.35 : 0.35
  );
  const [hasDoodles, setHasDoodles] = useState(() =>
    typeof initialTheme === "object" ? initialTheme?.hasDoodles ?? true : true
  );
  const [applyGlobally, setApplyGlobally] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [activeTab, setActiveTab] = useState("presets"); // 'presets' | 'wallpaper' | 'bubbles'

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const current = chatThemes[chatId] || globalChatTheme || "default";
      if (typeof current === "string") {
        setActivePresetId(current);
        setCustomWallpaper(null);
        setCustomBubbleColor(null);
        setWallpaperOpacity(0.35);
        setHasDoodles(getThemeById(current).hasDoodles);
      } else if (current && typeof current === "object") {
        setActivePresetId(current.presetId || "default");
        setCustomWallpaper(current.customWallpaperUrl || null);
        setCustomBubbleColor(current.customBubbleColor || null);
        setWallpaperOpacity(current.wallpaperOpacity ?? 0.35);
        setHasDoodles(current.hasDoodles ?? true);
      }
    }
  }, [isOpen, chatId, chatThemes, globalChatTheme]);

  if (!isOpen) return null;

  // Resolve preview styles in real time
  const previewThemeConfig = {
    presetId: activePresetId,
    customWallpaperUrl: customWallpaper,
    customBubbleColor: customBubbleColor,
    wallpaperOpacity,
    hasDoodles,
  };
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const styles = resolveThemeStyles(previewThemeConfig, isDark);

  const handleSelectPreset = (presetId) => {
    setActivePresetId(presetId);
    setCustomBubbleColor(null);
    const preset = getThemeById(presetId);
    setHasDoodles(preset.hasDoodles);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file (JPG, PNG, WebP).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setCustomWallpaper(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    setCustomWallpaper(urlInput.trim());
    setUrlInput("");
  };

  const handleSaveTheme = () => {
    const themeToSave = {
      presetId: activePresetId,
      customWallpaperUrl: customWallpaper,
      customBubbleColor: customBubbleColor,
      wallpaperOpacity,
      hasDoodles,
    };

    if (applyGlobally) {
      setGlobalChatTheme(themeToSave);
    } else if (selectedChat?.id) {
      setChatTheme(selectedChat.id, themeToSave);
    } else {
      setGlobalChatTheme(themeToSave);
    }
    onClose();
  };

  const handleResetDefault = () => {
    setActivePresetId("default");
    setCustomWallpaper(null);
    setCustomBubbleColor(null);
    setWallpaperOpacity(0.35);
    setHasDoodles(true);
    if (applyGlobally) {
      setGlobalChatTheme("default");
    } else if (selectedChat?.id) {
      setChatTheme(selectedChat.id, "default");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn select-none">
      {/* Click outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Main Container Card */}
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#121118] border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col md:flex-row max-h-[92vh] animate-scaleIn text-zinc-900 dark:text-white">
        
        {/* LEFT COLUMN: Controls & Presets */}
        <div className="w-full md:w-[54%] flex flex-col border-b md:border-b-0 md:border-r border-black/10 dark:border-white/10 max-h-[48vh] md:max-h-full overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center font-bold shadow-md">
                <Palette size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white tracking-tight">Chat Theme</h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {selectedChat ? `Customizing for ${selectedChat.name}` : "Global Chat Theme"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 px-6 pt-3 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
            <button
              onClick={() => setActiveTab("presets")}
              className={`flex items-center gap-1.5 pb-2.5 px-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "presets"
                  ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <Sparkles size={13} />
              <span>Theme Presets</span>
            </button>

            <button
              onClick={() => setActiveTab("wallpaper")}
              className={`flex items-center gap-1.5 pb-2.5 px-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "wallpaper"
                  ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <ImageIcon size={13} />
              <span>Custom Wallpaper</span>
            </button>

            <button
              onClick={() => setActiveTab("bubbles")}
              className={`flex items-center gap-1.5 pb-2.5 px-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "bubbles"
                  ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <Layers size={13} />
              <span>Bubble Colors</span>
            </button>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {activeTab === "presets" && (
              <div className="grid grid-cols-2 gap-2.5">
                {CHAT_THEME_PRESETS.map((preset) => {
                  const isSelected = activePresetId === preset.id && !customBubbleColor;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between h-24 relative overflow-hidden group active:scale-[0.98] ${
                        isSelected
                          ? "border-zinc-900 dark:border-white ring-2 ring-zinc-900/20 dark:ring-white/30 bg-black/5 dark:bg-white/10 shadow-md"
                          : "border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/30 bg-black/[0.02] dark:bg-white/[0.03]"
                      }`}
                    >
                      <div
                        className="absolute inset-0 opacity-40 group-hover:opacity-75 transition-opacity"
                        style={{ background: preset.previewGradient }}
                      />
                      <div className="relative z-10 flex justify-between items-start">
                        <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                          {preset.name}
                        </span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center shadow font-bold flex-shrink-0">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <p className="relative z-10 text-[10.5px] text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-tight">
                        {preset.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "wallpaper" && (
              <div className="space-y-4">
                {/* Upload from Local Storage */}
                <div>
                  <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1.5 flex items-center gap-1.5">
                    <Upload size={13} />
                    <span>Upload from Device / Local Storage</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-black/15 dark:border-white/15 hover:border-zinc-900 dark:hover:border-white hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-all flex items-center justify-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                  >
                    <Upload size={15} />
                    <span>Select Image from Computer / Phone</span>
                  </button>
                </div>

                {/* Or Paste Direct Image URL */}
                <div>
                  <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1.5 flex items-center gap-1.5">
                    <ImageIcon size={13} />
                    <span>Or Paste Image Link / URL</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://example.com/wallpaper.jpg"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="flex-1 bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 rounded-2xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                    />
                    <button
                      type="button"
                      onClick={handleApplyUrl}
                      disabled={!urlInput.trim()}
                      className="px-4 py-2 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold disabled:opacity-40 transition-all hover:opacity-90 active:scale-95"
                    >
                      Load
                    </button>
                  </div>
                </div>

                {/* Curated Gallery Wallpapers */}
                <div>
                  <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-2">
                    Curated Atmospheric Wallpapers
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {CURATED_WALLPAPERS.map((item) => {
                      const isSelected = customWallpaper === item.url;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setCustomWallpaper(item.url)}
                          className={`relative h-18 rounded-2xl overflow-hidden border cursor-pointer group transition-all ${
                            isSelected
                              ? "ring-2 ring-zinc-900 dark:ring-white border-transparent scale-95 shadow-md"
                              : "border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 opacity-85 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={item.thumb}
                            alt={item.name}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-1.5">
                            <span className="text-[10px] font-semibold text-white truncate drop-shadow">
                              {item.name}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white text-black flex items-center justify-center shadow font-bold">
                              <Check size={10} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Wallpaper Opacity / Dimming Slider */}
                <div className="space-y-1.5 pt-2 border-t border-black/5 dark:border-white/5">
                  <div className="flex justify-between items-center text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <Sliders size={13} />
                      <span>Wallpaper Opacity</span>
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {Math.round(wallpaperOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.85"
                    step="0.05"
                    value={wallpaperOpacity}
                    onChange={(e) => setWallpaperOpacity(parseFloat(e.target.value))}
                    className="w-full accent-zinc-900 dark:accent-white cursor-pointer"
                  />
                </div>

                {/* Chat Doodles Pattern Toggle */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-zinc-900 dark:text-white">
                      Chat Doodle Pattern
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Overlay classic subtle chat doodles
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasDoodles}
                    onChange={(e) => setHasDoodles(e.target.checked)}
                    className="w-4 h-4 rounded border-black/20 dark:border-white/20 accent-zinc-900 dark:accent-white cursor-pointer"
                  />
                </div>

                {customWallpaper && (
                  <button
                    type="button"
                    onClick={() => setCustomWallpaper(null)}
                    className="w-full py-2 rounded-xl text-xs font-bold text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    Remove Custom Wallpaper
                  </button>
                )}
              </div>
            )}

            {activeTab === "bubbles" && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Custom Outgoing Message Bubble Colors
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {CUSTOM_BUBBLE_GRADIENTS.map((b) => {
                    const isSelected = customBubbleColor === b.gradient;
                    return (
                      <div
                        key={b.id}
                        onClick={() => setCustomBubbleColor(b.gradient)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group ${
                          isSelected
                            ? "border-zinc-900 dark:border-white ring-2 ring-zinc-900/20 dark:ring-white/30 bg-black/5 dark:bg-white/10 shadow-md"
                            : "border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/30 bg-black/[0.02] dark:bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-6 h-6 rounded-xl shadow-sm flex-shrink-0"
                            style={{ background: b.gradient }}
                          />
                          <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                            {b.name}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center shadow font-bold">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-black/10 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.02] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={applyGlobally}
                  onChange={(e) => setApplyGlobally(e.target.checked)}
                  className="w-4 h-4 rounded border-black/20 dark:border-white/20 accent-zinc-900 dark:accent-white cursor-pointer"
                />
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Apply to all chats
                </span>
              </label>

              <button
                type="button"
                onClick={handleResetDefault}
                className="text-[11.5px] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 transition-colors"
                title="Reset theme to default"
              >
                <RotateCcw size={12} />
                <span>Reset Default</span>
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTheme}
                className="flex-1 py-2.5 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-black text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-md"
              >
                Apply Theme
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Real-Time Interactive Live Chat Preview */}
        <div className="w-full md:w-[46%] flex flex-col bg-zinc-100/80 dark:bg-[#0c0b10] relative overflow-hidden">
          {/* Header of Mock Chat Preview */}
          <div className="px-4 py-3 bg-white/70 dark:bg-[#14131b]/80 backdrop-blur-md border-b border-black/5 dark:border-white/5 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-full overflow-hidden shadow-sm ring-1 ring-black/10 dark:ring-white/20">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                  alt="Contact"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-black" />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-900 dark:text-white leading-tight">
                  {selectedChat?.name || "Emma Watson"}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  online
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/5 dark:bg-white/5 text-[10px] text-zinc-500 font-medium">
              <Lock size={10} />
              <span>Preview</span>
            </div>
          </div>

          {/* Live Chat Message Area with Real-Time Background & Bubbles */}
          <div className="flex-1 p-4 flex flex-col justify-end space-y-3 relative overflow-hidden">
            {/* 1. Theme Wallpaper Gradient or Custom Image */}
            {styles.customWallpaperUrl ? (
              <div
                className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-300"
                style={{
                  backgroundImage: `url(${styles.customWallpaperUrl})`,
                  opacity: styles.wallpaperOpacity,
                }}
              />
            ) : (
              <div
                className="absolute inset-0 z-0 transition-all duration-300"
                style={{
                  background: styles.wallpaperGradient,
                  opacity: 0.9,
                }}
              />
            )}

            {/* 2. Optional SVG Doodle Overlay */}
            {styles.hasDoodles && (
              <div
                className="absolute inset-0 z-0 pointer-events-none opacity-25 dark:opacity-20 transition-opacity"
                style={{
                  backgroundImage: `url("${CHAT_DOODLE_SVG}")`,
                  backgroundSize: "280px 280px",
                }}
              />
            )}

            {/* Mock Messages Content */}
            <div className="relative z-10 space-y-3 text-[13px] leading-snug">
              {/* Timestamp Pill */}
              <div className="flex justify-center">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-black/10 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 backdrop-blur-md">
                  Today
                </span>
              </div>

              {/* Incoming Bubble */}
              <div className="flex flex-col items-start max-w-[85%]">
                <div
                  className="p-3 rounded-2xl rounded-tl-sm shadow-sm transition-all duration-200"
                  style={{
                    background: styles.bubbleIncomingSurface,
                    color: styles.bubbleIncomingText,
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <p>Hey! How does this chat theme look in real-time? ✨</p>
                  <div className="flex justify-end items-center gap-1 mt-1 text-[9.5px] opacity-70">
                    <span>10:42 AM</span>
                  </div>
                </div>
              </div>

              {/* Outgoing Bubble */}
              <div className="flex flex-col items-end max-w-[88%] ml-auto">
                <div
                  className="p-3 rounded-2xl rounded-tr-sm shadow-md transition-all duration-200"
                  style={{
                    background: styles.bubbleOutgoingGradient,
                    color: styles.bubbleOutgoingText,
                  }}
                >
                  <p>It looks stunning! The bubbles and background match perfectly 🚀</p>
                  <div className="flex justify-end items-center gap-1 mt-1 text-[9.5px] opacity-80">
                    <span>10:43 AM</span>
                    <CheckCheck size={13} strokeWidth={2.5} className="text-sky-300 ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Mock Mini Voice Message Outgoing */}
              <div className="flex flex-col items-end max-w-[88%] ml-auto">
                <div
                  className="p-2.5 rounded-2xl rounded-tr-sm shadow-md flex items-center gap-2.5 transition-all duration-200"
                  style={{
                    background: styles.bubbleOutgoingGradient,
                    color: styles.bubbleOutgoingText,
                  }}
                >
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                    <Mic size={13} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-1 h-3">
                      {[40, 70, 90, 60, 80, 45, 100, 65, 80, 50, 75, 40].map((h, i) => (
                        <span
                          key={i}
                          style={{ height: `${h}%` }}
                          className={`w-[2px] rounded-full ${i < 6 ? "bg-current opacity-100" : "bg-current opacity-30"}`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between items-center text-[9px] opacity-80 font-mono">
                      <span>0:14</span>
                      <span className="flex items-center gap-0.5 font-sans">
                        <span>10:44 AM</span>
                        <CheckCheck size={11} strokeWidth={2.5} className="text-sky-300" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mock Message Input Bar */}
            <div className="relative z-10 pt-2 flex items-center gap-2">
              <div className="flex-1 h-9 rounded-2xl bg-white/80 dark:bg-white/10 backdrop-blur-xl border border-black/10 dark:border-white/10 px-3 flex items-center justify-between text-zinc-400 text-xs shadow-inner">
                <span className="text-[11.5px]">Type a message...</span>
                <Smile size={15} />
              </div>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md"
                style={{ background: styles.accentColor }}
              >
                <Mic size={15} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatThemeModal;
