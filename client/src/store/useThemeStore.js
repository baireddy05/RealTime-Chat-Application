import { create } from "zustand";

const applyThemeToDOM = (theme) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }
  
  // Update mobile meta theme color
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", theme === "dark" ? "#0e1217" : "#f0f3f8");
  }
};

const getInitialTheme = () => {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem("pulse-theme");
  const theme = saved === "light" || saved === "dark" ? saved : "dark";
  applyThemeToDOM(theme);
  return theme;
};

export const useThemeStore = create((set) => ({
  theme: getInitialTheme(),
  setTheme: (newTheme) => {
    localStorage.setItem("pulse-theme", newTheme);
    applyThemeToDOM(newTheme);
    set({ theme: newTheme });
  },
  toggleTheme: () => {
    set((state) => {
      const nextTheme = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("pulse-theme", nextTheme);
      applyThemeToDOM(nextTheme);
      return { theme: nextTheme };
    });
  },
}));
