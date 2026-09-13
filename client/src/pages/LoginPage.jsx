import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { Link } from "react-router-dom";
import { Loader, Lock, Eye, EyeOff, AlertCircle, Mail, Sun, Moon, Sparkles } from "lucide-react";

const LoginPage = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { login, isLoggingIn } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const handleQuickLogin = async (identifier) => {
    setErrorMessage("");
    const credentials = { email: identifier, password: "password123" };
    setFormData(credentials);
    try {
      await login(credentials);
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || err?.message || "Login failed");
    }
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
    <div className="flex h-[100dvh] w-full bg-[rgb(var(--bg-app-rgb))] overflow-hidden select-none">
      
      {/* Left Panel: Visual/Branding */}
      <div className="hidden lg:flex w-[55%] relative items-center justify-center overflow-hidden apple-ambient-bg">
        {/* Dynamic Ambient Blur Spots */}
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full blur-spot-1 pointer-events-none z-0 transition-all duration-1000 animate-pulse-slow opacity-80" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full blur-spot-2 pointer-events-none z-0 transition-all duration-1000 animate-pulse-slow opacity-80" />
        
        {/* Decorative Floating Glass Elements */}
        <div className="absolute top-1/4 right-1/4 w-32 h-32 rounded-3xl glass-heavy rotate-12 animate-slide-up animation-delay-200" />
        <div className="absolute bottom-1/3 left-1/4 w-24 h-24 rounded-full glass-panel -rotate-12 animate-slide-up animation-delay-500" />
        <div className="absolute top-1/2 left-1/3 w-16 h-16 rounded-xl glass-surface rotate-45 animate-fade-in animation-delay-700" />

        <div className="relative z-10 flex flex-col items-center justify-center text-center p-12 max-w-2xl animate-fade-in">
          <div className="w-24 h-24 mb-8 rounded-[2rem] bg-accent-primary/20 border border-white/20 shadow-glass flex items-center justify-center backdrop-blur-xl">
            <Sparkles className="w-12 h-12 text-accent-primary" />
          </div>
          <h1 className="text-5xl font-bold text-theme-main tracking-tight mb-6 leading-tight">
            Connect seamlessly <br/> with <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-secondary">Pulse</span>
          </h1>
          <p className="text-lg text-theme-muted max-w-md mx-auto leading-relaxed">
            Experience the future of real-time communication with our beautifully crafted, ultra-fast messaging workspace.
          </p>
        </div>
      </div>

      {/* Right Panel: Interactive Form */}
      <div className="w-full lg:w-[45%] h-full flex flex-col relative glass-surface shadow-[-20px_0_40px_rgba(0,0,0,0.05)] border-l border-[var(--glass-border)] z-20">
        
        {/* Top Header - Theme Toggle */}
        <div className="absolute top-6 right-8 z-50">
          <button
            onClick={toggleTheme}
            className="p-3 rounded-full glass-input hover:bg-[var(--glass-active)] text-theme-muted hover:text-theme-main transition-all active:scale-90"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-accent-primary" />}
          </button>
        </div>

        {/* Scrollable Form Container */}
        <div className="flex-1 overflow-y-auto flex flex-col justify-center px-8 sm:px-16 md:px-24 py-12">
          
          <div className="w-full max-w-[400px] mx-auto animate-slide-up">
            <div className="mb-10 text-center lg:text-left">
              <h2 className="text-3xl font-bold text-theme-main tracking-tight mb-2">Welcome Back</h2>
              <p className="text-theme-muted text-sm">Please enter your details to sign in.</p>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3 animate-fade-in">
                <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div className="space-y-2">
                <label className="text-[12px] font-semibold text-theme-muted tracking-widest uppercase">Email or Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-theme-muted/50 group-focus-within:text-accent-primary transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-[var(--glass-hover)] border border-[var(--glass-border)] rounded-2xl text-theme-main placeholder-theme-muted/40 text-[15px] focus:outline-none focus:bg-[var(--glass-active)] focus:border-accent-primary/70 focus:ring-4 focus:ring-accent-primary/10 transition-all"
                    placeholder="user1@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-semibold text-theme-muted tracking-widest uppercase">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-theme-muted/50 group-focus-within:text-accent-primary transition-colors" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full pl-12 pr-12 py-3.5 bg-[var(--glass-hover)] border border-[var(--glass-border)] rounded-2xl text-theme-main placeholder-theme-muted/40 text-[15px] focus:outline-none focus:bg-[var(--glass-active)] focus:border-accent-primary/70 focus:ring-4 focus:ring-accent-primary/10 transition-all"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-theme-muted/50 hover:text-theme-main transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full mt-6 bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold py-4 rounded-2xl transition-all shadow-glass flex justify-center items-center gap-2 disabled:opacity-50 text-[15px] active:scale-[0.98]"
              >
                {isLoggingIn ? <Loader className="animate-spin h-5 w-5" /> : "Sign In"}
              </button>
            </form>

            <div className="mt-8 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--glass-border)]"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 bg-[var(--bg-surface-rgb)] text-theme-muted uppercase tracking-widest font-semibold">Or use demo accounts</span>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { label: "User 1", id: "user1@example.com" },
                { label: "User 2", id: "user2@example.com" },
                { label: "User 3", id: "user3@example.com" },
              ].map((u) => (
                <button
                  key={u.label}
                  type="button"
                  disabled={isLoggingIn}
                  onClick={() => handleQuickLogin(u.id)}
                  className="py-3 px-3 rounded-2xl bg-[var(--glass-hover)] hover:bg-[var(--glass-active)] border border-[var(--glass-border)] text-theme-main text-[13px] font-semibold transition-all text-center active:scale-[0.96] disabled:opacity-40"
                >
                  {u.label}
                </button>
              ))}
            </div>

            <div className="mt-10 text-center text-[14px] text-theme-muted">
              Don't have an account?{" "}
              <Link to="/signup" className="text-accent-primary hover:text-accent-secondary font-semibold ml-1 transition-colors">
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
