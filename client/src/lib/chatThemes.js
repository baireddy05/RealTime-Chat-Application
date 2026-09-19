// Standard Chat Themes & Acoustic Visual Presets for Pulse Chat

// Subtle SVG Doodle pattern for chat background
export const CHAT_DOODLE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" fill="none" viewBox="0 0 280 280"><g opacity="0.6" stroke="%238a8d91" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M25 40a15 15 0 1030 0 15 15 0 10-30 0zM35 35l10 10M45 35l-10 10M110 30h25a8 8 0 018 8v12a8 8 0 01-8 8h-15l-10 6v-6h0a8 8 0 010-16M195 25l12 20 22 4-16 16 4 22-22-12-22 12 4-22-16-16 22-4zM25 120c8 0 14 6 14 14v10a14 14 0 01-28 0v-10c0-8 6-14 14-14zM100 115a18 18 0 1136 0 18 18 0 01-36 0zM118 105v20M108 115h20M200 130a15 15 0 0125-5l5 25-25-5a15 15 0 01-5-15zM40 210l15-15 15 15-15 15zM120 200c0-10 8-18 18-18s18 8 18 18c0 12-18 25-18 25s-18-13-18-25zM210 205h30v25h-30zM225 195v10"/></g></svg>`;

export const CHAT_THEME_PRESETS = [
  {
    id: "default",
    name: "Pulse Glass (Default)",
    description: "Adaptive liquid glass with sleek monochromatic bubbles",
    accentColor: "#6366f1",
    bubbleOutgoing: "linear-gradient(135deg, #18181b 0%, #27272a 100%)",
    bubbleOutgoingDark: "linear-gradient(135deg, #00f0ff 0%, #00d2ff 100%)",
    bubbleOutgoingText: "#ffffff",
    bubbleOutgoingTextDark: "#04080f",
    bubbleIncoming: "rgba(255, 255, 255, 0.95)",
    bubbleIncomingDark: "rgba(255, 255, 255, 0.07)",
    bubbleIncomingText: "#18181b",
    bubbleIncomingTextDark: "#f4f4f5",
    wallpaperGradient: "transparent",
    hasDoodles: true,
    previewGradient: "linear-gradient(135deg, #18181b, #71717a)",
  },
  {
    id: "emerald-glow",
    name: "Emerald Glow",
    description: "Classic emerald green bubbles with atmospheric tone",
    accentColor: "#10b981",
    bubbleOutgoing: "linear-gradient(135deg, #005c4b 0%, #008069 100%)",
    bubbleOutgoingDark: "linear-gradient(135deg, #005c4b 0%, #008069 100%)",
    bubbleOutgoingText: "#ffffff",
    bubbleOutgoingTextDark: "#e9edef",
    bubbleIncoming: "rgba(255, 255, 255, 0.85)",
    bubbleIncomingDark: "rgba(32, 44, 51, 0.90)",
    bubbleIncomingText: "#111b21",
    bubbleIncomingTextDark: "#e9edef",
    wallpaperGradient: "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 78, 59, 0.22))",
    hasDoodles: true,
    previewGradient: "linear-gradient(135deg, #005c4b, #008069, #052e16)",
  },
  {
    id: "midnight-navy",
    name: "Midnight Navy",
    description: "Deep oceanic royal indigo & sapphire glow",
    accentColor: "#3b82f6",
    bubbleOutgoing: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
    bubbleOutgoingDark: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
    bubbleOutgoingText: "#ffffff",
    bubbleOutgoingTextDark: "#ffffff",
    bubbleIncoming: "rgba(255, 255, 255, 0.85)",
    bubbleIncomingDark: "rgba(15, 23, 42, 0.85)",
    bubbleIncomingText: "#0f172a",
    bubbleIncomingTextDark: "#f1f5f9",
    wallpaperGradient: "linear-gradient(135deg, rgba(29, 78, 216, 0.15), rgba(15, 23, 42, 0.35))",
    hasDoodles: true,
    previewGradient: "linear-gradient(135deg, #1e3a8a, #2563eb, #0f172a)",
  },
  {
    id: "crimson-velvet",
    name: "Crimson Velvet",
    description: "Warm radiant rose and deep burgundy elegance",
    accentColor: "#f43f5e",
    bubbleOutgoing: "linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)",
    bubbleOutgoingDark: "linear-gradient(135deg, #be123c 0%, #e11d48 100%)",
    bubbleOutgoingText: "#ffffff",
    bubbleOutgoingTextDark: "#ffffff",
    bubbleIncoming: "rgba(255, 255, 255, 0.85)",
    bubbleIncomingDark: "rgba(35, 15, 22, 0.85)",
    bubbleIncomingText: "#1c1917",
    bubbleIncomingTextDark: "#ffe4e6",
    wallpaperGradient: "linear-gradient(135deg, rgba(244, 63, 94, 0.12), rgba(76, 5, 25, 0.25))",
    hasDoodles: true,
    previewGradient: "linear-gradient(135deg, #be123c, #fb7185, #4c0519)",
  },
  {
    id: "lavender-amethyst",
    name: "Lavender Amethyst",
    description: "Dreamy violet purple and soft lilac gradient",
    accentColor: "#8b5cf6",
    bubbleOutgoing: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
    bubbleOutgoingDark: "linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)",
    bubbleOutgoingText: "#ffffff",
    bubbleOutgoingTextDark: "#ffffff",
    bubbleIncoming: "rgba(255, 255, 255, 0.85)",
    bubbleIncomingDark: "rgba(24, 16, 38, 0.85)",
    bubbleIncomingText: "#1e1b4b",
    bubbleIncomingTextDark: "#f5f3ff",
    wallpaperGradient: "linear-gradient(135deg, rgba(139, 92, 246, 0.14), rgba(46, 16, 101, 0.30))",
    hasDoodles: true,
    previewGradient: "linear-gradient(135deg, #6d28d9, #a78bfa, #2e1065)",
  },
  {
    id: "sunset-amber",
    name: "Sunset Amber",
    description: "Golden hour sunset with energetic amber and bronze",
    accentColor: "#f59e0b",
    bubbleOutgoing: "linear-gradient(135deg, #d97706 0%, #ea580c 100%)",
    bubbleOutgoingDark: "linear-gradient(135deg, #b45309 0%, #d97706 100%)",
    bubbleOutgoingText: "#ffffff",
    bubbleOutgoingTextDark: "#ffffff",
    bubbleIncoming: "rgba(255, 255, 255, 0.85)",
    bubbleIncomingDark: "rgba(35, 20, 10, 0.85)",
    bubbleIncomingText: "#1c1917",
    bubbleIncomingTextDark: "#fef3c7",
    wallpaperGradient: "linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(67, 20, 7, 0.28))",
    hasDoodles: true,
    previewGradient: "linear-gradient(135deg, #d97706, #f97316, #431407)",
  },
  {
    id: "cyber-cyan",
    name: "Cyber Cyan",
    description: "Futuristic electric teal, neon cyan, and dark titanium",
    accentColor: "#06b6d4",
    bubbleOutgoing: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
    bubbleOutgoingDark: "linear-gradient(135deg, #0e7490 0%, #0891b2 100%)",
    bubbleOutgoingText: "#ffffff",
    bubbleOutgoingTextDark: "#ffffff",
    bubbleIncoming: "rgba(255, 255, 255, 0.85)",
    bubbleIncomingDark: "rgba(10, 25, 32, 0.85)",
    bubbleIncomingText: "#082f49",
    bubbleIncomingTextDark: "#ecfeff",
    wallpaperGradient: "linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(8, 47, 73, 0.35))",
    hasDoodles: true,
    previewGradient: "linear-gradient(135deg, #0891b2, #22d3ee, #082f49)",
  },
  {
    id: "coffee-mocha",
    name: "Coffee Mocha",
    description: "Rich roasted espresso and creamy caramel warmth",
    accentColor: "#a16207",
    bubbleOutgoing: "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
    bubbleOutgoingDark: "linear-gradient(135deg, #5c280b 0%, #78350f 100%)",
    bubbleOutgoingText: "#ffffff",
    bubbleOutgoingTextDark: "#ffffff",
    bubbleIncoming: "rgba(255, 255, 255, 0.85)",
    bubbleIncomingDark: "rgba(28, 19, 14, 0.85)",
    bubbleIncomingText: "#292524",
    bubbleIncomingTextDark: "#fef3c7",
    wallpaperGradient: "linear-gradient(135deg, rgba(146, 64, 14, 0.12), rgba(41, 15, 5, 0.28))",
    hasDoodles: true,
    previewGradient: "linear-gradient(135deg, #78350f, #b45309, #1c0a00)",
  },
  {
    id: "oled-minimal",
    name: "OLED Pitch Black",
    description: "Absolute minimalist deep slate and charcoal matrix",
    accentColor: "#a1a1aa",
    bubbleOutgoing: "linear-gradient(135deg, #27272a 0%, #3f3f46 100%)",
    bubbleOutgoingDark: "linear-gradient(135deg, #18181b 0%, #27272a 100%)",
    bubbleOutgoingText: "#ffffff",
    bubbleOutgoingTextDark: "#ffffff",
    bubbleIncoming: "rgba(255, 255, 255, 0.85)",
    bubbleIncomingDark: "rgba(18, 18, 20, 0.90)",
    bubbleIncomingText: "#18181b",
    bubbleIncomingTextDark: "#d4d4d8",
    wallpaperGradient: "linear-gradient(135deg, rgba(0, 0, 0, 0.35), rgba(24, 24, 27, 0.45))",
    hasDoodles: false,
    previewGradient: "linear-gradient(135deg, #09090b, #27272a, #000000)",
  },
];

export const getThemeById = (themeId) => {
  const normalizedId = themeId && themeId.includes("emerald") ? "emerald-glow" : themeId;
  return CHAT_THEME_PRESETS.find((t) => t.id === normalizedId) || CHAT_THEME_PRESETS[0];
};

// Read a live UI-theme CSS variable (set by useThemeStore). Used so the
// "default" chat theme always matches the active whole-app UI theme instead
// of hardcoding bubble colors that clash with it.
const readUiVar = (name, fallback) => {
  try {
    if (typeof document === "undefined") return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
};

const resolveDefaultPreset = (preset, isDark) => {
  // Fallbacks mirror the signature Neon Cyber dark / monochrome light looks
  const fallbackOutgoing = isDark
    ? "linear-gradient(135deg, #00f0ff 0%, #00d2ff 100%)"
    : preset.bubbleOutgoing;
  return {
    id: preset.id,
    name: preset.name,
    accentColor: preset.accentColor,
    bubbleOutgoingGradient: readUiVar("--bubble-outgoing-gradient", fallbackOutgoing),
    bubbleOutgoingText: readUiVar(
      "--bubble-outgoing-text",
      isDark ? "#04080f" : preset.bubbleOutgoingText
    ),
    bubbleIncomingSurface: readUiVar(
      "--bubble-incoming-surface",
      isDark ? "rgba(255, 255, 255, 0.08)" : preset.bubbleIncoming
    ),
    bubbleIncomingText: readUiVar(
      "--bubble-incoming-text",
      isDark ? "#f4f4f6" : preset.bubbleIncomingText
    ),
    wallpaperGradient: preset.wallpaperGradient || "transparent",
    hasDoodles: preset.hasDoodles ?? true,
    customWallpaperUrl: null,
    wallpaperOpacity: 0.25,
  };
};

export const resolveThemeStyles = (themeConfigOrId, isDark = true) => {
  if (!themeConfigOrId) {
    return resolveThemeStyles("default", isDark);
  }

  // If it's a string matching a preset ID
  if (typeof themeConfigOrId === "string") {
    const preset = getThemeById(themeConfigOrId);
    // "default" follows the active whole-app UI theme (all 10 UI themes)
    if (preset.id === "default") {
      return resolveDefaultPreset(preset, isDark);
    }
    return {
      id: preset.id,
      name: preset.name,
      accentColor: preset.accentColor,
      bubbleOutgoingGradient: isDark ? preset.bubbleOutgoingDark : preset.bubbleOutgoing,
      bubbleOutgoingText: isDark ? preset.bubbleOutgoingTextDark : preset.bubbleOutgoingText,
      bubbleIncomingSurface: isDark ? preset.bubbleIncomingDark : preset.bubbleIncoming,
      bubbleIncomingText: isDark ? preset.bubbleIncomingTextDark : preset.bubbleIncomingText,
      wallpaperGradient: preset.wallpaperGradient || "transparent",
      hasDoodles: preset.hasDoodles ?? true,
      customWallpaperUrl: null,
      wallpaperOpacity: 0.25,
    };
  }

  // If it's a custom theme object
  const preset = getThemeById(themeConfigOrId?.presetId || "default");
  // A "default"-based custom theme without its own bubble color still
  // follows the active whole-app UI theme.
  if (preset.id === "default" && !themeConfigOrId?.customBubbleColor) {
    const base = resolveDefaultPreset(preset, isDark);
    return {
      ...base,
      id: "custom",
      name: themeConfigOrId?.name || preset.name,
      accentColor: themeConfigOrId?.accentColor || preset.accentColor,
      wallpaperGradient: preset.wallpaperGradient || "transparent",
      hasDoodles: themeConfigOrId?.hasDoodles ?? preset.hasDoodles,
      customWallpaperUrl: themeConfigOrId?.customWallpaperUrl || null,
      wallpaperOpacity: themeConfigOrId?.wallpaperOpacity ?? 0.35,
    };
  }
  return {
    id: themeConfigOrId?.presetId || "custom",
    name: themeConfigOrId?.name || preset.name,
    accentColor: themeConfigOrId?.accentColor || preset.accentColor,
    bubbleOutgoingGradient:
      themeConfigOrId?.customBubbleColor || (isDark ? preset.bubbleOutgoingDark : preset.bubbleOutgoing),
    bubbleOutgoingText: isDark ? preset.bubbleOutgoingTextDark : preset.bubbleOutgoingText,
    bubbleIncomingSurface: isDark ? preset.bubbleIncomingDark : preset.bubbleIncoming,
    bubbleIncomingText: isDark ? preset.bubbleIncomingTextDark : preset.bubbleIncomingText,
    wallpaperGradient: preset.wallpaperGradient || "transparent",
    hasDoodles: themeConfigOrId?.hasDoodles ?? preset.hasDoodles,
    customWallpaperUrl: themeConfigOrId?.customWallpaperUrl || null,
    wallpaperOpacity: themeConfigOrId?.wallpaperOpacity ?? 0.35,
  };
};
