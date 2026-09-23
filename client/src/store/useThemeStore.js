import { create } from "zustand";
import { UI_THEMES, getUiTheme } from "../lib/uiThemes";
import { CUSTOM_COLOR_STORAGE_KEY, loadCustomVars } from "../lib/uiCustomColors";

const UI_THEME_KEY = "pulse-ui-theme";
const LEGACY_THEME_KEY = "pulse-theme";

const DEFAULT_BY_SCHEME = { dark: "midnight", light: "daylight" };

export const applyUiThemeToDOM = (theme, customVars) => {
  if (typeof document === "undefined" || !theme) return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.scheme);
  root.setAttribute("data-ui-theme", theme.id);
  root.classList.toggle("dark", theme.scheme === "dark");
  root.classList.toggle("light", theme.scheme === "light");
  root.style.colorScheme = theme.scheme;
  // Custom colors live outside the preset so switching presets never loses
  // them; clear any previous override keys first so removed keys reset.
  const prev = applyUiThemeToDOM._customKeys || [];
  prev.forEach((key) => {
    if (!customVars || !(key in customVars)) root.style.removeProperty(key);
  });
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  const keys = [];
  if (customVars) {
    Object.entries(customVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
      keys.push(key);
    });
  }
  applyUiThemeToDOM._customKeys = keys;

  // Update mobile meta theme color
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", theme.meta);
  }
};

const resolveInitialUiThemeId = () => {
  if (typeof window === "undefined") return "midnight";
  try {
    const saved = localStorage.getItem(UI_THEME_KEY);
    if (saved && UI_THEMES.some((t) => t.id === saved)) return saved;
    // Migrate legacy dark/light preference
    if (localStorage.getItem(LEGACY_THEME_KEY) === "light") return "daylight";
  } catch {}
  return "midnight";
};

const initialUiThemeId = resolveInitialUiThemeId();
const initialCustomVars = loadCustomVars();
applyUiThemeToDOM(getUiTheme(initialUiThemeId), initialCustomVars);

export const useThemeStore = create((set, get) => ({
  uiThemeId: initialUiThemeId,
  // User color overrides applied on top of the active preset (persisted).
  customVars: initialCustomVars,
  // Legacy dark/light scheme of the active UI theme (kept for all consumers)
  theme: getUiTheme(initialUiThemeId).scheme,
  setUiTheme: (id) => {
    const theme = getUiTheme(id);
    try {
      localStorage.setItem(UI_THEME_KEY, theme.id);
      localStorage.setItem(LEGACY_THEME_KEY, theme.scheme);
    } catch {}
    applyUiThemeToDOM(theme, get().customVars);
    set({ uiThemeId: theme.id, theme: theme.scheme });
  },
  // Merge color overrides, persist, and paint immediately (live preview).
  setCustomVars: (patch) => {
    const next = { ...get().customVars, ...patch };
    try {
      localStorage.setItem(CUSTOM_COLOR_STORAGE_KEY, JSON.stringify(next));
    } catch {}
    applyUiThemeToDOM(getUiTheme(get().uiThemeId), next);
    set({ customVars: next });
  },
  // Drop all overrides and repaint the bare preset.
  resetCustomVars: () => {
    try {
      localStorage.removeItem(CUSTOM_COLOR_STORAGE_KEY);
    } catch {}
    applyUiThemeToDOM(getUiTheme(get().uiThemeId), {});
    set({ customVars: {} });
  },
  // Back-compat: map legacy mode switches onto default UI themes
  setTheme: (newTheme) => {
    get().setUiTheme(DEFAULT_BY_SCHEME[newTheme] || "midnight");
  },
  toggleTheme: () => {
    const nextScheme = get().theme === "dark" ? "light" : "dark";
    get().setUiTheme(DEFAULT_BY_SCHEME[nextScheme]);
  },
}));
