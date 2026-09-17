import { useState, useRef } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Mail,
  User,
  Sun,
  Moon,
  Shield,
  Activity,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const SignUpPage = () => {
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { signup, isSigningUp } = useAuthStore();
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
  const leftPanelRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!leftPanelRef.current) return;
    const rect = leftPanelRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const nx = (x / rect.width) * 2 - 1;
    const ny = (y / rect.height) * 2 - 1;
    setMouseState({ x, y, nx, ny, isHovering: true });
  };

  const handleMouseLeave = () => {
    setMouseState((prev) => ({ ...prev, nx: 0, ny: 0, isHovering: false }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    if (!formData.username.trim() || !formData.email.trim() || !formData.password.trim()) {
      setErrorMessage("All fields are required");
      return;
    }
    if (formData.password.length < 6) {
      setErrorMessage("Password must be at least 6 characters");
      return;
    }
    try {
      await signup(formData);
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || "Failed to create account");
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-[rgb(var(--bg-app-rgb))] overflow-hidden select-none font-sans relative">
      {/* ── Top Header Navigation Bar (Back to Welcome on Both Mobile & Laptop, and Theme Toggle) ── */}
      <div className="absolute top-4 left-4 right-4 sm:top-5 sm:left-6 sm:right-6 flex items-center justify-between z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <button
            onClick={() => navigate("/welcome")}
            type="button"
            className="p-2 sm:p-2.5 rounded-full glass-input hover:bg-[var(--glass-active)] text-theme-muted hover:text-theme-main transition-all active:scale-90 cursor-pointer shadow-sm border border-black/10 dark:border-white/10 flex items-center gap-1.5 text-xs font-semibold"
            title="Back to Welcome"
          >
            <ArrowLeft size={16} />
            <span>Welcome</span>
          </button>
        </div>

        <div className="pointer-events-auto">
          <button
            onClick={toggleTheme}
            className="p-2.5 sm:p-3 rounded-full glass-input hover:bg-[var(--glass-active)] text-theme-muted hover:text-theme-main transition-all active:scale-90 cursor-pointer shadow-sm border border-black/10 dark:border-white/10"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            type="button"
          >
            {theme === "dark" ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} className="text-accent-primary" />}
          </button>
        </div>
      </div>

      {/* ── Desktop Left Panel: Interactive Pulse Experience ── */}
      <div
        ref={leftPanelRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="hidden lg:flex w-[55%] relative items-center justify-center overflow-hidden apple-ambient-bg cursor-default"
        style={{ perspective: "1200px" }}
      >
        {/* Dynamic Interactive Spotlight following Mouse Pointer */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-500 z-0"
          style={{
            opacity: mouseState.isHovering ? 1 : 0.6,
            background: mouseState.isHovering
              ? `radial-gradient(650px circle at ${mouseState.x}px ${mouseState.y}px, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.15), rgba(6, 182, 212, 0.05), transparent 70%)`
              : "radial-gradient(600px circle at 50% 50%, rgba(99, 102, 241, 0.18), rgba(139, 92, 246, 0.10), transparent 70%)",
          }}
        />

        {/* Ambient Background Glow Spheres */}
        <div
          className="absolute top-[-10%] left-[-10%] w-[550px] h-[550px] rounded-full blur-spot-1 pointer-events-none z-0 transition-transform duration-700 ease-out opacity-75"
          style={{
            transform: `translate3d(${mouseState.nx * -40}px, ${mouseState.ny * -40}px, 0)`,
          }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[550px] h-[550px] rounded-full blur-spot-2 pointer-events-none z-0 transition-transform duration-700 ease-out opacity-75"
          style={{
            transform: `translate3d(${mouseState.nx * 50}px, ${mouseState.ny * 50}px, 0)`,
          }}
        />

        {/* Central 3D Card */}
        <div
          className="relative z-10 flex flex-col items-center justify-center text-center p-10 max-w-xl transition-transform duration-200 ease-out"
          style={{
            transform: `rotateY(${mouseState.nx * 14}deg) rotateX(${-mouseState.ny * 14}deg) translateZ(30px)`,
            transformStyle: "preserve-3d",
          }}
        >
          <div className="relative group mb-8">
            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-cyan-500/30 rounded-[3rem] blur-2xl group-hover:blur-3xl transition-all duration-500 opacity-80" />
            <div className="relative w-32 h-32 rounded-[3rem] bg-black/[0.03] dark:bg-white/[0.06] shadow-2xl backdrop-blur-2xl flex items-center justify-center overflow-hidden transition-all duration-500 group-hover:scale-105">
              <img
                src="/logo.png"
                alt="Pulse Logo"
                className="w-20 h-20 object-contain drop-shadow-[0_8px_20px_rgba(99,102,241,0.5)] transition-transform duration-500 group-hover:scale-110"
              />
            </div>
          </div>

          <h1 className="text-5xl font-extrabold text-theme-main tracking-tight mb-5 leading-tight">
            Connect seamlessly <br />
            with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">
              Pulse
            </span>
          </h1>

          <p className="text-base text-theme-muted max-w-md mx-auto leading-relaxed font-normal">
            Experience the future of real-time communication with our beautifully crafted, ultra-fast messaging workspace.
          </p>

          <div className="mt-8 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 dark:bg-white/[0.04] border border-white/15 dark:border-white/10 backdrop-blur-md">
            <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span className="text-xs text-theme-muted font-medium tracking-wide">
              Ultra-Responsive Synchronous Engine
            </span>
          </div>

          {/* Creator Credits */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] text-theme-muted select-none">
            <span>Created by</span>
            <span className="font-semibold text-theme-main">Byreddy Rithwik Reddy</span>
          </div>
        </div>
      </div>

      {/* ── Right / Form Panel (Responsive across Mobile and Laptop) ── */}
      <div className="w-full lg:w-[45%] h-full flex flex-col z-20 glass-surface shadow-[-20px_0_40px_rgba(0,0,0,0.05)] border-l border-[var(--glass-border)] bg-[rgb(var(--bg-app-rgb))]">
        {/* Scrollable Form Container */}
        <div className="flex-1 overflow-y-auto flex flex-col justify-center px-5 sm:px-10 md:px-14 lg:px-20 py-16 sm:py-12">
          <div className="w-full max-w-[400px] mx-auto animate-slide-up">
            {/* Mobile Header with Logo */}
            <div className="flex items-center gap-3 mb-6 lg:hidden justify-center">
              <img src="/logo.png" alt="Pulse Logo" className="w-12 h-12 object-contain drop-shadow" />
              <span className="text-2xl font-extrabold tracking-tight text-theme-main">Pulse</span>
            </div>

            <div className="mb-8 text-center lg:text-left">
              <h2 className="text-3xl font-extrabold text-theme-main tracking-tight mb-2">Create Account</h2>
              <p className="text-theme-muted text-sm">Join Pulse to start messaging.</p>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm flex items-start gap-3 animate-fade-in">
                <AlertCircle size={18} className="text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-theme-muted tracking-wider uppercase">
                  Username
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="size-5 text-theme-muted group-focus-within:text-accent-primary transition-colors" />
                  </div>
                  <input
                    type="text"
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl glass-input text-theme-main placeholder:text-theme-muted/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all border border-black/10 dark:border-white/10"
                    placeholder="johndoe"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-theme-muted tracking-wider uppercase">
                  Email
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="size-5 text-theme-muted group-focus-within:text-accent-primary transition-colors" />
                  </div>
                  <input
                    type="email"
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl glass-input text-theme-main placeholder:text-theme-muted/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all border border-black/10 dark:border-white/10"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-theme-muted tracking-wider uppercase">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="size-5 text-theme-muted group-focus-within:text-accent-primary transition-colors" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full pl-11 pr-11 py-3.5 rounded-2xl glass-input text-theme-main placeholder:text-theme-muted/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all border border-black/10 dark:border-white/10"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-theme-muted hover:text-theme-main transition-colors cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5 text-theme-muted/50" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSigningUp}
                className="w-full py-4 px-6 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] font-bold text-sm shadow-xl active:scale-[0.98] hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isSigningUp ? (
                  <>
                    <Loader className="size-5 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <span>Create Account</span>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-theme-muted">
                Already have an account?{" "}
                <Link to="/login" className="font-semibold text-theme-main hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
