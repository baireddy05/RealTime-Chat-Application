// Whole-UI custom color layer. Users pick colors with native color inputs;
// this module maps each editable control to its CSS variable(s) and converts
// between the picker's #rrggbb and whatever format the variable uses
// (hex, rgb()/rgba(), or "r g b" triplets). Overrides are stored by
// useThemeStore, persisted to localStorage, and applied on top of whichever
// preset theme is active (switching presets keeps your custom colors).

// Groups shown in the Settings appearance tab, in order. Covers every plain
// color variable in the theme set (gradients and shadows are derived from
// presets and intentionally excluded).
export const CUSTOM_COLOR_GROUPS = [
  {
    id: "backgrounds",
    label: "Backgrounds",
    fields: [
      { id: "bg-app", label: "App background", vars: ["--bg-app-rgb"] },
      { id: "bg-rail", label: "Activity rail", vars: ["--bg-rail-rgb"] },
      { id: "bg-sidebar", label: "Chats sidebar", vars: ["--bg-sidebar-rgb"] },
      { id: "bg-chat", label: "Chat area", vars: ["--bg-chat-rgb"] },
      { id: "bg-surface", label: "Cards / surfaces", vars: ["--bg-surface-rgb"] },
      { id: "bg-surface-bright", label: "Raised surfaces", vars: ["--bg-surface-bright-rgb"] },
      { id: "bg-card", label: "Menu cards", vars: ["--bg-card-rgb"] },
      { id: "bg-card-hover", label: "Menu cards (hover)", vars: ["--bg-card-hover-rgb"] },
      { id: "bg-input", label: "Input fields", vars: ["--bg-input-rgb"] },
    ],
  },
  {
    id: "text",
    label: "Text",
    fields: [
      { id: "text-main", label: "Primary text", vars: ["--text-main-rgb"] },
      { id: "text-secondary", label: "Secondary text", vars: ["--txt-secondary-rgb"] },
      { id: "text-muted", label: "Muted text", vars: ["--text-muted-rgb"] },
      { id: "txt-primary", label: "Body text", vars: ["--txt-primary-rgb"] },
      { id: "txt-muted", label: "Faint text", vars: ["--txt-muted-rgb"] },
      { id: "txt-dim", label: "Dim hints", vars: ["--txt-dim-rgb"] },
    ],
  },
  {
    id: "outgoing",
    label: "My message bubbles",
    fields: [
      { id: "out-bg", label: "Bubble color", vars: ["--bubble-outgoing-bg"], gradient: "--bubble-outgoing-gradient" },
      { id: "out-text", label: "Message text", vars: ["--bubble-outgoing-text"] },
      { id: "out-subtext", label: "Time / caption", vars: ["--bubble-outgoing-subtext"] },
      { id: "out-ticks", label: "Read ticks", vars: ["--bubble-outgoing-ticks"] },
      { id: "out-border", label: "Bubble border", vars: ["--bubble-outgoing-border"] },
    ],
  },
  {
    id: "incoming",
    label: "Their message bubbles",
    fields: [
      { id: "in-bg", label: "Bubble color", vars: ["--bubble-incoming-bg", "--bubble-incoming-surface"] },
      { id: "in-text", label: "Message text", vars: ["--bubble-incoming-text"] },
      { id: "in-subtext", label: "Time / caption", vars: ["--bubble-incoming-subtext"] },
      { id: "in-ticks", label: "Read ticks", vars: ["--bubble-incoming-ticks"] },
      { id: "in-border", label: "Bubble border", vars: ["--bubble-incoming-border"] },
    ],
  },
  {
    id: "accent",
    label: "Accent",
    fields: [
      { id: "accent-1", label: "Primary accent", vars: ["--accent-primary-rgb"] },
      { id: "accent-2", label: "Secondary accent", vars: ["--accent-secondary-rgb"] },
      { id: "accent-3", label: "Emerald accent", vars: ["--accent-emerald-rgb"] },
    ],
  },
  {
    id: "presence",
    label: "Presence",
    fields: [
      { id: "online", label: "Online dot", vars: ["--status-online-rgb"] },
      { id: "offline", label: "Offline dot", vars: ["--status-offline-rgb"] },
    ],
  },
  {
    id: "surfaces",
    label: "Panels & overlays",
    fields: [
      { id: "glass-panel", label: "Floating panels", vars: ["--glass-panel"] },
      { id: "glass-sidebar", label: "Sidebar panel", vars: ["--glass-sidebar"] },
      { id: "glass-chat", label: "Chat panel", vars: ["--glass-chat"] },
      { id: "glass-header", label: "Headers", vars: ["--glass-header"] },
      { id: "glass-heavy", label: "Modals", vars: ["--glass-heavy"] },
      { id: "glass-input", label: "Input pills", vars: ["--glass-input"] },
      { id: "glass-surface", label: "Glass surface", vars: ["--glass-surface"] },
      { id: "glass-hover", label: "Hover wash", vars: ["--glass-hover"] },
      { id: "glass-active", label: "Pressed wash", vars: ["--glass-active"] },
      { id: "modal-backdrop", label: "Backdrop dim", vars: ["--modal-backdrop"] },
    ],
  },
  {
    id: "borders",
    label: "Borders & dividers",
    fields: [
      { id: "glass-border", label: "Glass border", vars: ["--glass-border"] },
      { id: "glass-divider", label: "Dividers", vars: ["--glass-divider"] },
    ],
  },
  {
    id: "pills",
    label: "Filter pills & badges",
    fields: [
      { id: "pill-bg", label: "Active pill", vars: ["--pill-active-bg"] },
      { id: "pill-text", label: "Pill text", vars: ["--pill-active-text"] },
      { id: "pill-border", label: "Pill border", vars: ["--pill-active-border"] },
    ],
  },
  {
    id: "senders",
    label: "Group sender colors",
    fields: [
      { id: "sender-1", label: "Sender 1", vars: ["--sender-1"] },
      { id: "sender-2", label: "Sender 2", vars: ["--sender-2"] },
      { id: "sender-3", label: "Sender 3", vars: ["--sender-3"] },
      { id: "sender-4", label: "Sender 4", vars: ["--sender-4"] },
      { id: "sender-5", label: "Sender 5", vars: ["--sender-5"] },
      { id: "sender-6", label: "Sender 6", vars: ["--sender-6"] },
    ],
  },
];

export const CUSTOM_COLOR_STORAGE_KEY = "pulse-ui-custom-vars";

const clampByte = (n) => Math.max(0, Math.min(255, Math.round(n)));

export const hexToRgb = (hex) => {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

export const rgbToHex = (r, g, b) =>
  `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, "0")).join("")}`;

/** Parse any supported CSS color value into { hex, alpha }. */
export const cssToHex = (value) => {
  if (typeof value !== "string") return null;
  const v = value.trim();
  const hex = hexToRgb(v);
  if (hex) return { hex: rgbToHex(...hex), alpha: 1 };
  const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (m) {
    return {
      hex: rgbToHex(Number(m[1]), Number(m[2]), Number(m[3])),
      alpha: m[4] === undefined ? 1 : Number(m[4]),
    };
  }
  const t = v.match(/^(\d+)\s+(\d+)\s+(\d+)$/);
  if (t) {
    return { hex: rgbToHex(Number(t[1]), Number(t[2]), Number(t[3])), alpha: 1 };
  }
  return null;
};

/** Rebuild a CSS value in the same format as `current`, with a new hex color. */
export const hexToCssValue = (hex, current) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const parsed = typeof current === "string" ? cssToHex(current) : null;
  const alpha = parsed ? parsed.alpha : 1;
  const src = (current || "").trim();
  if (/^rgba?\(/i.test(src)) {
    return alpha < 1
      ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
      : `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }
  if (/^\d+\s+\d+\s+\d+$/.test(src)) {
    return `${rgb[0]} ${rgb[1]} ${rgb[2]}`;
  }
  return rgbToHex(...rgb);
};

/** Darken a hex color by `amount` (0-1) for gradient depth. */
export const darkenHex = (hex, amount = 0.18) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb[0] * (1 - amount), rgb[1] * (1 - amount), rgb[2] * (1 - amount));
};

/** Read the live value of a CSS variable from <html> (inline or computed). */
export const readLiveVar = (name) => {
  try {
    const inline = document.documentElement.style.getPropertyValue(name).trim();
    if (inline) return inline;
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  } catch {
    return "";
  }
};

/** Resolve a field's current color as #rrggbb for the picker input. */
export const fieldCurrentHex = (field, fallback = "#888888") => {
  for (const name of field.vars) {
    const parsed = cssToHex(readLiveVar(name));
    if (parsed) return parsed.hex;
  }
  return fallback;
};

/** Build the { var: value } map a field selection produces, including the
 *  derived outgoing-bubble gradient so the new color is actually visible. */
export const fieldToVars = (field, hex) => {
  const out = {};
  for (const name of field.vars) {
    out[name] = hexToCssValue(hex, readLiveVar(name));
  }
  if (field.gradient) {
    out[field.gradient] = `linear-gradient(135deg, ${hex} 0%, ${darkenHex(hex)} 100%)`;
  }
  return out;
};

/** Read persisted overrides from localStorage (validated shape). */
export const loadCustomVars = () => {
  try {
    const raw = localStorage.getItem(CUSTOM_COLOR_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const clean = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === "string" && k.startsWith("--") && typeof v === "string" && v.length < 300) {
        clean[k] = v;
      }
    }
    return clean;
  } catch {
    return {};
  }
};
