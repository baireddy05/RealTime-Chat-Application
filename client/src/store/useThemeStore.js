import { create } from "zustand";
import { UI_THEMES, getUiTheme } from "../lib/uiThemes";

const UI_THEME_KEY = "pulse-ui-theme";
const LEGACY_THEME_KEY = "pulse-theme";

const DEFAULT_BY_SCHEME = { dark: "midnight", light: "daylight" };

export const applyUiThemeToDOM = (theme) => {
  if (typeof document === "undefined" || !theme) return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.scheme);
  root.setAttribute("data-ui-theme", theme.id);
  root.classList.toggle("dark", theme.scheme === "dark");
  root.classList.toggle("light", theme.scheme === "light");
  root.style.colorScheme = theme.scheme;
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

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
applyUiThemeToDOM(getUiTheme(initialUiThemeId));

export const useThemeStore = create((set, get) => ({
  uiThemeId: initialUiThemeId,
  // Legacy dark/light scheme of the active UI theme (kept for all consumers)
  theme: getUiTheme(initialUiThemeId).scheme,
  setUiTheme: (id) => {
    const theme = getUiTheme(id);
    try {
      localStorage.setItem(UI_THEME_KEY, theme.id);
      localStorage.setItem(LEGACY_THEME_KEY, theme.scheme);
    } catch {}
    applyUiThemeToDOM(theme);
    set({ uiThemeId: theme.id, theme: theme.scheme });
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
