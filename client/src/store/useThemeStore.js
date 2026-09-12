import { create } from "zustand";

const getInitialTheme = () => {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem("pulse-theme");
  if (saved === "light" || saved === "dark") {
    document.documentElement.setAttribute("data-theme", saved);
    return saved;
  }
  // Default to dark mode (Cosmic Obsidian Glass)
  document.documentElement.setAttribute("data-theme", "dark");
  return "dark";
};

export const useThemeStore = create((set) => ({
  theme: getInitialTheme(),
  setTheme: (newTheme) => {
    localStorage.setItem("pulse-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    set({ theme: newTheme });
  },
  toggleTheme: () => {
    set((state) => {
      const nextTheme = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("pulse-theme", nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
      return { theme: nextTheme };
    });
  },
}));
