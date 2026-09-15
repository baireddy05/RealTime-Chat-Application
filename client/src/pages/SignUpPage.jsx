import { useState, useRef } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { Link } from "react-router-dom";
import { Loader, Lock, Eye, EyeOff, AlertCircle, Mail, User, Sun, Moon, Zap, Shield, Activity, ArrowLeft } from "lucide-react";

const SignUpPage = () => {
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { signup, isSigningUp } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  // Interactive mouse physics for the Pulse visual panel
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
    <div className="flex h-[100dvh] w-full bg-[rgb(var(--bg-app-rgb))] overflow-hidden select-none font-sans">
      
      {/* ── Left Panel: Interactive Pulse Experience ── */}
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

        {/* Ambient Multi-layer Background Glow Spheres with Parallax */}
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

        {/* Interactive Floating Micro-Badges with 3D Parallax */}
        <div
          className="absolute top-16 left-16 z-20 transition-transform duration-500 ease-out pointer-events-none"
          style={{
            transform: `translate3d(${mouseState.nx * -28}px, ${mouseState.ny * -28}px, 20px)`,
          }}
        >
          <div className="px-4 py-2 rounded-2xl bg-white/10 dark:bg-white/[0.06] backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-glass flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold tracking-wide text-zinc-900 dark:text-white/90">
              Live Mesh Active
            </span>
          </div>
        </div>

        <div
          className="absolute top-28 right-20 z-20 transition-transform duration-500 ease-out pointer-events-none"
          style={{
            transform: `translate3d(${mouseState.nx * 32}px, ${mouseState.ny * 32}px, 30px)`,
          }}
        >
          <div className="px-3.5 py-2 rounded-2xl bg-white/10 dark:bg-white/[0.06] backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-glass flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-mono font-medium">⚡ &lt; 15ms latency</span>
          </div>
        </div>

        <div
          className="absolute bottom-20 left-24 z-20 transition-transform duration-500 ease-out pointer-events-none"
          style={{
            transform: `translate3d(${mouseState.nx * -22}px, ${mouseState.ny * -22}px, 15px)`,
          }}
        >
          <div className="px-3.5 py-2 rounded-2xl bg-white/10 dark:bg-white/[0.06] backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-glass flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-medium">E2EE Protected</span>
          </div>
        </div>

        {/* Concentric Pulse Shockwave Rings radiating outward */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div
            className="absolute rounded-full border border-indigo-500/20 dark:border-indigo-400/15 animate-ping opacity-40"
            style={{
              width: "280px",
              height: "280px",
              animationDuration: "3s",
              transform: `translate3d(${mouseState.nx * 15}px, ${mouseState.ny * 15}px, 0)`,
            }}
          />
          <div
            className="absolute rounded-full border border-purple-500/20 dark:border-purple-400/15 animate-pulse opacity-30"
            style={{
              width: "420px",
              height: "420px",
              animationDuration: "4s",
              transform: `translate3d(${mouseState.nx * 10}px, ${mouseState.ny * 10}px, 0)`,
            }}
          />
          <div
            className="absolute rounded-full border border-cyan-500/15 dark:border-cyan-400/10 opacity-25"
            style={{
              width: "580px",
              height: "580px",
              transform: `translate3d(${mouseState.nx * 6}px, ${mouseState.ny * 6}px, 0)`,
            }}
          />
        </div>

        {/* Dynamic Real-time Heartbeat / Pulse Waveform */}
        <div className="absolute w-full px-8 pointer-events-none z-10 flex items-center justify-center opacity-40 dark:opacity-30">
          <svg
            className="w-full max-w-lg h-24 overflow-visible"
            viewBox="0 0 600 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="signupWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366F1" stopOpacity="0.05" />
                <stop offset="35%" stopColor="#6366F1" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#8B5CF6" stopOpacity="1" />
                <stop offset="65%" stopColor="#06B6D4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.05" />
              </linearGradient>
              <filter id="waveGlowSignup" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <path
              d="M 0 60 L 180 60 L 210 60 L 230 20 L 255 105 L 280 40 L 305 75 L 325 60 L 370 60 L 600 60"
              stroke="url(#signupWaveGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#waveGlowSignup)"
            />
            <circle cx="255" cy="105" r="4" fill="#06B6D4" className="animate-ping" />
          </svg>
        </div>

        {/* ── Central 3D Interactive Card ── */}
        <div
          className="relative z-10 flex flex-col items-center justify-center text-center p-10 max-w-xl transition-transform duration-200 ease-out"
          style={{
            transform: `rotateY(${mouseState.nx * 14}deg) rotateX(${-mouseState.ny * 14}deg) translateZ(30px)`,
            transformStyle: "preserve-3d",
          }}
        >
          {/* Logo Badge with Glowing Liquid Glass */}
          <div className="relative group mb-8">
            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-cyan-500/30 rounded-[3rem] blur-2xl group-hover:blur-3xl transition-all duration-500 opacity-80" />
            
            <div className="relative w-32 h-32 rounded-[3rem] bg-black/[0.03] dark:bg-white/[0.06] shadow-2xl backdrop-blur-2xl flex items-center justify-center overflow-hidden transition-all duration-500 group-hover:scale-105">
              <div className="absolute -top-10 -left-10 w-24 h-24 bg-white/20 rounded-full blur-xl pointer-events-none" />
              
              <img
                src="/logo.svg"
                alt="Pulse Logo"
                className="w-20 h-20 object-contain drop-shadow-[0_8px_20px_rgba(99,102,241,0.5)] transition-transform duration-500 group-hover:scale-110"
              />
            </div>
          </div>

          <h1 className="text-5xl font-extrabold text-theme-main tracking-tight mb-5 leading-tight">
            Start your journey <br />
            with <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">Pulse</span>
          </h1>

          <p className="text-base text-theme-muted max-w-md mx-auto leading-relaxed font-normal">
            Create an account in seconds and instantly connect with your friends, teams, and communities.
          </p>

          <div className="mt-8 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 dark:bg-white/[0.04] border border-white/15 dark:border-white/10 backdrop-blur-md">
            <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span className="text-xs text-theme-muted font-medium tracking-wide">
              Ultra-Responsive Synchronous Engine
            </span>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Interactive Form ── */}
      <div className="w-full lg:w-[45%] h-full flex flex-col relative glass-surface shadow-[-20px_0_40px_rgba(0,0,0,0.05)] border-l border-[var(--glass-border)] z-20">
        
        {/* Top Header - Theme Toggle */}
        <div className="absolute top-6 right-8 z-50">
          <button
            onClick={toggleTheme}
            className="p-3 rounded-full glass-input hover:bg-[var(--glass-active)] text-theme-muted hover:text-theme-main transition-all active:scale-90 cursor-pointer shadow-sm"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            type="button"
          >
            {theme === "dark" ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-accent-primary" />}
          </button>
        </div>

        {/* Mobile Back to Welcome button */}
        <div className="lg:hidden absolute top-5 left-6 z-50">
          <Link
            to="/login"
            className="p-2.5 rounded-full glass-input hover:bg-[var(--glass-active)] text-theme-muted hover:text-theme-main transition-all active:scale-90 cursor-pointer shadow-sm border border-black/10 dark:border-white/10 flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft size={16} />
            <span>Welcome</span>
          </Link>
        </div>

        {/* Scrollable Form Container */}
        <div className="flex-1 overflow-y-auto flex flex-col justify-center px-5 sm:px-10 md:px-14 lg:px-20 py-12">
          
          <div className="w-full max-w-[400px] mx-auto animate-slide-up">
            
            {/* Mobile Header with Logo */}
            <div className="flex items-center gap-3 mb-8 lg:hidden justify-center">
              <img src="/logo.svg" alt="Pulse Logo" className="w-12 h-12 object-contain drop-shadow" />
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
                    <User className="h-5 w-5 text-theme-muted/50 group-focus-within:text-indigo-500 dark:group-focus-within:text-white transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-[var(--glass-hover)] border border-[var(--glass-border)] rounded-2xl text-theme-main placeholder-theme-muted/40 text-[15px] focus:outline-none focus:bg-[var(--glass-active)] focus:border-zinc-900 dark:focus:border-white focus:ring-4 focus:ring-black/5 dark:focus:ring-white/10 transition-all"
                    placeholder="johndoe"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-theme-muted tracking-wider uppercase">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-theme-muted/50 group-focus-within:text-indigo-500 dark:group-focus-within:text-white transition-colors" />
                  </div>
                  <input
                    type="email"
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

              {/* High-Contrast, Clearly Visible Create Account Button */}
              <button
                type="submit"
                disabled={isSigningUp}
                className="w-full mt-6 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-[#0d0c11] dark:hover:bg-zinc-100 font-bold py-4 rounded-2xl transition-all shadow-xl hover:shadow-2xl flex justify-center items-center gap-2 disabled:opacity-50 text-[15px] active:scale-[0.98] cursor-pointer"
              >
                {isSigningUp ? <Loader className="animate-spin h-5 w-5" /> : "Create Account"}
              </button>
            </form>

            <div className="mt-8 text-center text-[14px] text-theme-muted">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-zinc-900 dark:text-white font-bold hover:underline ml-1 transition-all"
              >
                Sign In
              </Link>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
