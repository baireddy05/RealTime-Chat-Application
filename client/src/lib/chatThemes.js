// Standard Chat Themes & Acoustic Visual Presets for Pulse Chat

// WhatsApp-style doodle wallpaper: a dense hand-drawn tile (chat bubbles,
// smileys, camera, mic, hearts, stars, music notes, pins, planes...) rendered
// as a repeating background. Two variants so doodles stay visible on both
// dark and light chat backgrounds. Single quotes inside the SVG keep the
// CSS url("...") wrapper valid; '#' must stay %23-encoded.
const buildDoodleSvg = (stroke) => `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' fill='none' viewBox='0 0 400 400'><g stroke='${stroke}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><g transform='translate(58,64)'><circle r='20'/><path d='M-7,-6 v5 M7,-6 v5'/><path d='M-10,6 Q0,15 10,6'/></g><g transform='translate(190,52) rotate(-8)'><rect x='-26' y='-20' width='52' height='34' rx='9'/><path d='M-12,14 l-4,12 l14,-10'/></g><g transform='translate(318,60)'><path d='M0,14 C-14,4 -26,-4 -26,-14 C-26,-22 -20,-27 -13,-27 C-7,-27 -2,-23 0,-20 C2,-23 7,-27 13,-27 C20,-27 26,-22 26,-14 C26,-4 14,4 0,14 Z'/></g><g transform='translate(70,170) rotate(12)'><path d='M0,-16 L4.7,-5.5 L16,-5.5 L7,1.5 L10.5,12.5 L0,6 L-10.5,12.5 L-7,1.5 L-16,-5.5 L-4.7,-5.5 Z'/></g><g transform='translate(190,160)'><ellipse cx='-8' cy='12' rx='7' ry='5' transform='rotate(-20 -8 12)'/><path d='M-1,12 V-14'/><path d='M-1,-14 C8,-12 14,-6 13,2'/></g><g transform='translate(312,164) rotate(-6)'><rect x='-22' y='-12' width='44' height='30' rx='7'/><circle r='8'/><path d='M-8,-12 v-5 h16 v5'/></g><g transform='translate(64,272)'><rect x='-9' y='-22' width='18' height='32' rx='9'/><path d='M-16,-2 a16,16 0 0 0 32,0 M0,14 v10 M-9,28 h18'/></g><g transform='translate(185,268) rotate(18)'><path d='M6,-20 v26 a10,10 0 0 1 -20,0 v-30 a6,6 0 0 1 12,0 v24'/></g><g transform='translate(310,272)'><path d='M0,18 C-12,4 -18,-4 -18,-12 A18,18 0 0 1 18,-12 C18,-4 12,4 0,18 Z'/><circle cy='-11' r='6'/></g><g transform='translate(60,360)'><rect x='-22' y='-14' width='44' height='32' rx='6'/><circle cx='-10' cy='-4' r='3.5'/><path d='M-22,12 L-8,-2 L0,6 L8,-4 L22,10'/></g><g transform='translate(180,356)'><circle r='18'/><path d='M-5,-9 L9,0 L-5,9 Z'/></g><g transform='translate(300,356) rotate(-15)'><path d='M6,-14 A17,17 0 1,0 6,14 A13,13 0 1,1 6,-14 Z'/></g><g transform='translate(250,110) rotate(10)'><path d='M-20,-10 L20,-2 L-4,14 L-8,2 Z'/></g><g transform='translate(130,228)'><circle r='9'/><path d='M0,-16 v-6 M0,16 v6 M-16,0 h-6 M16,0 h6 M-11,-11 l-4,-4 M11,-11 l4,-4 M-11,11 l-4,4 M11,11 l4,4'/></g><g transform='translate(252,222)'><path d='M0,-12 V12 M-12,0 H12'/><circle cx='19' cy='-15' r='2.4'/></g><circle cx='128' cy='120' r='2.6'/><circle cx='352' cy='120' r='2.6'/><circle cx='120' cy='322' r='2.6'/><circle cx='250' cy='322' r='2.6'/><circle cx='24' cy='220' r='2.6'/><circle cx='362' cy='232' r='2.6'/></g></svg>`;

// White doodles for dark chat backgrounds, dark-slate for light ones.
export const CHAT_DOODLE_SVG = buildDoodleSvg('%23ffffff');
export const CHAT_DOODLE_SVG_LIGHT = buildDoodleSvg('%23334155');

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
    doodleSvg: isDark ? CHAT_DOODLE_SVG : CHAT_DOODLE_SVG_LIGHT,
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
      doodleSvg: isDark ? CHAT_DOODLE_SVG : CHAT_DOODLE_SVG_LIGHT,
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
      doodleSvg: isDark ? CHAT_DOODLE_SVG : CHAT_DOODLE_SVG_LIGHT,
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
    doodleSvg: isDark ? CHAT_DOODLE_SVG : CHAT_DOODLE_SVG_LIGHT,
    customWallpaperUrl: themeConfigOrId?.customWallpaperUrl || null,
    wallpaperOpacity: themeConfigOrId?.wallpaperOpacity ?? 0.35,
  };
};
