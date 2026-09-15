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
  Sun,
  Moon,
  Zap,
  Shield,
  Activity,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const LoginPage = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mobileShowForm, setMobileShowForm] = useState(false);
  const { login, isLoggingIn } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  // Interactive mouse physics for the Pulse visual panel
  const [mouseState, setMouseState] = useState({
    x: 0,
    y: 0,
    nx: 0, // normalized -1 to +1
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
    if (!formData.email.trim() || !formData.password.trim()) {
      setErrorMessage("Please enter both email and password");
      return;
    }
    try {
      await login({ email: formData.email.trim(), password: formData.password });
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || err?.message || "Invalid email/username or password");
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-[rgb(var(--bg-app-rgb))] overflow-hidden select-none font-sans relative">
      {/* ── Top Header Navigation Bar (Theme Toggle & Back on Mobile) ── */}
      <div className="absolute top-4 left-4 right-4 sm:top-5 sm:left-6 sm:right-6 flex items-center justify-between z-50 pointer-events-none">
        <div className="pointer-events-auto">
          {mobileShowForm && (
            <button
              onClick={() => setMobileShowForm(false)}
              type="button"
              className="lg:hidden p-2.5 rounded-full glass-input hover:bg-[var(--glass-active)] text-theme-muted hover:text-theme-main transition-all active:scale-90 cursor-pointer shadow-sm border border-black/10 dark:border-white/10 flex items-center gap-1.5 text-xs font-semibold"
            >
              <ArrowLeft size={16} />
              <span>Welcome</span>
            </button>
          )}
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

      {/* ── MOBILE WELCOME SCREEN (Visible on mobile when not showing form) ── */}
      <div
        className={`lg:hidden fixed inset-0 z-30 flex flex-col justify-between p-6 overflow-hidden apple-ambient-bg transition-all duration-300 ${
          mobileShowForm ? "opacity-0 pointer-events-none translate-y-6" : "opacity-100 pointer-events-auto translate-y-0"
        }`}
      >
        {/* Ambient Glows */}
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full blur-spot-1 pointer-events-none opacity-60" />
        <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full blur-spot-2 pointer-events-none opacity-60" />

        {/* Center Hero Card */}
        <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-6 relative z-10">
          {/* Glowing Liquid Glass Logo Badge */}
          <div className="relative group mb-6">
            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-cyan-500/30 rounded-[2.5rem] blur-2xl opacity-90 animate-pulse" />
            <div className="relative w-28 h-28 rounded-[2.5rem] bg-black/[0.03] dark:bg-white/[0.06] shadow-2xl backdrop-blur-2xl flex items-center justify-center overflow-hidden">
              <img
                src="/logo.svg"
                alt="Pulse Logo"
                className="w-18 h-18 object-contain drop-shadow-[0_8px_20px_rgba(99,102,241,0.5)]"
              />
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-theme-main tracking-tight mb-3 leading-tight">
            Connect seamlessly <br />
            with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">
              Pulse
            </span>
          </h1>

          <p className="text-[13.5px] text-theme-muted max-w-xs mx-auto leading-relaxed font-normal mb-5">
            Experience the future of real-time communication with our beautifully crafted, ultra-fast messaging workspace.
          </p>

          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 dark:bg-white/[0.05] border border-white/15 dark:border-white/10 backdrop-blur-md">
            <Activity className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span className="text-[11px] text-theme-muted font-medium tracking-wide">
              Ultra-Responsive Synchronous Engine
            </span>
          </div>
        </div>

        {/* Bottom Actions & E2EE Badge */}
        <div className="w-full flex flex-col items-center gap-3.5 relative z-10 pb-4">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-theme-muted mb-1">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>E2EE Protected & Secure</span>
          </div>

          <div className="w-full flex flex-col sm:flex-row gap-2.5 max-w-sm">
            <button
              onClick={() => setMobileShowForm(true)}
              type="button"
              className="w-full py-3.5 px-6 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] font-bold text-sm shadow-xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Sign In</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => navigate("/signup")}
              type="button"
              className="w-full py-3.5 px-6 rounded-2xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-zinc-900 dark:text-white font-bold text-sm backdrop-blur-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Create Account</span>
            </button>
          </div>

          {/* Creator Credits */}
          <div className="flex items-center justify-center gap-1 text-[11px] text-theme-muted select-none pt-1">
            <span>Created by</span>
            <span className="font-semibold text-theme-main">Byreddy Rithwik Reddy</span>
          </div>
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
                src="/logo.svg"
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

      {/* ── Form Panel (Always visible on desktop; on mobile shown when mobileShowForm is true) ── */}
      <div
        className={`w-full lg:w-[45%] h-full flex flex-col relative glass-surface shadow-[-20px_0_40px_rgba(0,0,0,0.05)] border-l border-[var(--glass-border)] z-20 transition-all duration-300 ${
          mobileShowForm ? "flex" : "hidden lg:flex"
        }`}
      >
        {/* Mobile Back to Welcome button */}
        <div className="lg:hidden absolute top-5 left-6 z-50">
          <button
            onClick={() => setMobileShowForm(false)}
            type="button"
            className="p-2.5 rounded-full glass-input hover:bg-[var(--glass-active)] text-theme-muted hover:text-theme-main transition-all active:scale-90 cursor-pointer shadow-sm border border-black/10 dark:border-white/10 flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft size={16} />
            <span>Welcome</span>
          </button>
        </div>

        {/* Scrollable Form Container */}
        <div className="flex-1 overflow-y-auto flex flex-col justify-center px-5 sm:px-10 md:px-14 lg:px-20 py-12">
          <div className="w-full max-w-[400px] mx-auto animate-slide-up">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8 lg:hidden justify-center">
              <img src="/logo.svg" alt="Pulse Logo" className="w-12 h-12 object-contain drop-shadow" />
              <span className="text-2xl font-extrabold tracking-tight text-theme-main">Pulse</span>
            </div>

            <div className="mb-8 text-center lg:text-left">
              <h2 className="text-3xl font-extrabold text-theme-main tracking-tight mb-2">Welcome Back</h2>
              <p className="text-theme-muted text-sm">Please enter your details to sign in.</p>
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
                  Email or Username
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-theme-muted/50 group-focus-within:text-indigo-500 dark:group-focus-within:text-white transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-[var(--glass-hover)] border border-[var(--glass-border)] rounded-2xl text-theme-main placeholder-theme-muted/40 text-[15px] focus:outline-none focus:bg-[var(--glass-active)] focus:border-zinc-900 dark:focus:border-white focus:ring-4 focus:ring-black/5 dark:focus:ring-white/10 transition-all"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-theme-muted tracking-wider uppercase">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-theme-muted/50 group-focus-within:text-indigo-500 dark:group-focus-within:text-white transition-colors" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full pl-12 pr-12 py-3.5 bg-[var(--glass-hover)] border border-[var(--glass-border)] rounded-2xl text-theme-main placeholder-theme-muted/40 text-[15px] focus:outline-none focus:bg-[var(--glass-active)] focus:border-zinc-900 dark:focus:border-white focus:ring-4 focus:ring-black/5 dark:focus:ring-white/10 transition-all"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-theme-muted/50 hover:text-theme-main transition-colors focus:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full mt-6 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-[#0d0c11] dark:hover:bg-zinc-100 font-bold py-4 rounded-2xl transition-all shadow-xl hover:shadow-2xl flex justify-center items-center gap-2 disabled:opacity-50 text-[15px] active:scale-[0.98] cursor-pointer"
              >
                {isLoggingIn ? <Loader className="animate-spin h-5 w-5" /> : "Sign In"}
              </button>
            </form>

            <div className="mt-8 text-center text-[14px] text-theme-muted">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-zinc-900 dark:text-white font-bold hover:underline ml-1 transition-all"
              >
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
