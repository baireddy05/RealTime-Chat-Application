import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useThemeStore } from "../store/useThemeStore";
import {
  Sun,
  Moon,
  Shield,
  Activity,
  ArrowRight,
  UserPlus,
  Sparkles,
  Zap,
} from "lucide-react";

const WelcomePage = () => {
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  // Interactive mouse physics for desktop
  const [mouseState, setMouseState] = useState({
    x: 0,
    y: 0,
    nx: 0,
    ny: 0,
    isHovering: false,
  });
  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const nx = (x / rect.width) * 2 - 1;
    const ny = (y / rect.height) * 2 - 1;
    setMouseState({ x, y, nx, ny, isHovering: true });
  };

  const handleMouseLeave = () => {
    setMouseState((prev) => ({ ...prev, nx: 0, ny: 0, isHovering: false }));
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="flex flex-col min-h-[100dvh] w-full bg-[rgb(var(--bg-app-rgb))] overflow-x-hidden overflow-y-auto select-none font-sans relative apple-ambient-bg justify-between p-5 sm:p-8 md:p-10"
      style={{ perspective: "1200px" }}
    >
      {/* Dynamic Interactive Spotlight following Mouse Pointer on Desktop */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500 z-0 hidden md:block"
        style={{
          opacity: mouseState.isHovering ? 1 : 0.6,
          background: mouseState.isHovering
            ? `radial-gradient(750px circle at ${mouseState.x}px ${mouseState.y}px, rgba(99, 102, 241, 0.22), rgba(139, 92, 246, 0.14), rgba(6, 182, 212, 0.05), transparent 70%)`
            : "radial-gradient(700px circle at 50% 50%, rgba(99, 102, 241, 0.16), rgba(139, 92, 246, 0.08), transparent 70%)",
        }}
      />

      {/* Ambient Glow Spheres */}
      <div
        className="absolute top-[-10%] left-[-10%] w-[380px] sm:w-[550px] h-[380px] sm:h-[550px] rounded-full blur-spot-1 pointer-events-none z-0 transition-transform duration-700 ease-out opacity-70"
        style={{
          transform: `translate3d(${mouseState.nx * -30}px, ${mouseState.ny * -30}px, 0)`,
        }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[380px] sm:w-[550px] h-[380px] sm:h-[550px] rounded-full blur-spot-2 pointer-events-none z-0 transition-transform duration-700 ease-out opacity-70"
        style={{
          transform: `translate3d(${mouseState.nx * 40}px, ${mouseState.ny * 40}px, 0)`,
        }}
      />

      {/* ── Top Header Navigation Bar (Theme Toggle) ── */}
      <div className="w-full flex items-center justify-between z-20 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-black/[0.04] dark:bg-white/[0.08] backdrop-blur-xl border border-black/10 dark:border-white/10 flex items-center justify-center shadow-sm">
            <img src="/logo.svg" alt="Pulse" className="w-5 h-5 object-contain" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-theme-main">Pulse</span>
        </div>

        <button
          onClick={toggleTheme}
          className="p-2.5 sm:p-3 rounded-full glass-input hover:bg-[var(--glass-active)] text-theme-muted hover:text-theme-main transition-all active:scale-90 cursor-pointer shadow-sm border border-black/10 dark:border-white/10"
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          type="button"
        >
          {theme === "dark" ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} className="text-accent-primary" />}
        </button>
      </div>

      {/* ── Central Hero Section ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center text-center my-auto py-8 sm:py-12 relative z-10 max-w-2xl mx-auto transition-transform duration-200 ease-out"
        style={{
          transform: `rotateY(${mouseState.nx * 8}deg) rotateX(${-mouseState.ny * 8}deg) translateZ(20px)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Glowing Liquid Glass Logo Badge */}
        <div className="relative group mb-6 sm:mb-8">
          <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/35 via-purple-500/35 to-cyan-500/35 rounded-[2.5rem] sm:rounded-[3rem] blur-2xl group-hover:blur-3xl transition-all duration-500 opacity-90 animate-pulse" />
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-[2.5rem] sm:rounded-[3rem] bg-black/[0.03] dark:bg-white/[0.06] shadow-2xl backdrop-blur-2xl flex items-center justify-center overflow-hidden transition-all duration-500 group-hover:scale-105 border border-black/5 dark:border-white/10">
            <img
              src="/logo.svg"
              alt="Pulse Logo"
              className="w-14 h-14 sm:w-20 sm:h-20 object-contain drop-shadow-[0_8px_20px_rgba(99,102,241,0.5)] transition-transform duration-500 group-hover:scale-110"
            />
          </div>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-theme-main tracking-tight mb-4 sm:mb-5 leading-tight">
          Connect seamlessly <br />
          with{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">
            Pulse
          </span>
        </h1>

        <p className="text-sm sm:text-base md:text-lg text-theme-muted max-w-md sm:max-w-lg mx-auto leading-relaxed font-normal mb-6 sm:mb-8">
          Experience the future of real-time communication with our beautifully crafted, ultra-fast messaging workspace.
        </p>

        {/* Feature Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-8 sm:mb-10">
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 dark:bg-white/[0.05] border border-white/15 dark:border-white/10 backdrop-blur-md">
            <Activity className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span className="text-[11.5px] sm:text-xs text-theme-muted font-medium tracking-wide">
              Ultra-Fast Synchronous Engine
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 dark:bg-white/[0.05] border border-white/15 dark:border-white/10 backdrop-blur-md">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11.5px] sm:text-xs text-theme-muted font-medium tracking-wide">
              E2EE Protected
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md">
          <button
            onClick={() => navigate("/login")}
            type="button"
            className="w-full sm:w-1/2 py-3.5 px-6 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] font-bold text-sm shadow-xl active:scale-[0.98] hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Sign In</span>
            <ArrowRight size={16} />
          </button>

          <button
            onClick={() => navigate("/signup")}
            type="button"
            className="w-full sm:w-1/2 py-3.5 px-6 rounded-2xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-zinc-900 dark:text-white font-bold text-sm backdrop-blur-md active:scale-[0.98] hover:bg-black/10 dark:hover:bg-white/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles size={15} className="text-amber-400" />
            <span>Create Account</span>
          </button>
        </div>
      </div>

      {/* ── Footer / Creator Credits ── */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 z-20 max-w-6xl mx-auto pt-4 text-[11.5px] text-theme-muted select-none border-t border-black/5 dark:border-white/5">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
          <span>End-to-End Encrypted & Secure</span>
        </div>
        <div className="flex items-center gap-1">
          <span>Created by</span>
          <span className="font-semibold text-theme-main">Byreddy Rithwik Reddy</span>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
