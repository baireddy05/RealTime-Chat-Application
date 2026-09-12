import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { Link } from "react-router-dom";
import { Loader, Lock, Eye, EyeOff, AlertCircle, Mail, Sun, Moon } from "lucide-react";

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
    <div className="min-h-full min-h-[100dvh] flex items-center justify-center apple-ambient-bg px-4 py-8 relative overflow-hidden select-none">
      {/* Top right theme toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-5 right-5 z-50 p-2.5 rounded-full glass-surface border border-[var(--glass-border)] text-theme-muted hover:text-theme-main shadow-glass transition-transform active:scale-90"
        title={theme === "dark" ? "Switch to Arctic Prism (Light Mode)" : "Switch to Cosmic Obsidian (Dark Mode)"}
      >
        {theme === "dark" ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-accent-primary" />}
      </button>

      {/* Dynamic Ambient Blur Spots (Pro Tip) */}
      <div className="fixed -top-24 -left-24 w-[480px] h-[480px] rounded-full blur-spot-1 pointer-events-none z-0 transition-all duration-700 animate-pulse-slow" />
      <div className="fixed -bottom-24 -right-24 w-[520px] h-[520px] rounded-full blur-spot-2 pointer-events-none z-0 transition-all duration-700 animate-pulse-slow" />

      {/* Main Frosted Glass Card */}
      <div className="max-w-[400px] w-full glass-heavy rounded-3xl shadow-glass p-8 md:p-10 relative z-10 animate-scaleIn smooth-gpu border border-[var(--glass-border)]">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent-primary/20 border border-[var(--glass-border)] flex items-center justify-center mx-auto mb-5 shadow-glass text-accent-primary">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-accent-primary">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-[22px] font-semibold text-theme-main tracking-tight mb-1.5">Welcome back</h1>
          <p className="text-[13px] text-theme-muted">Sign in to your Pulse workspace</p>
        </div>

        {/* Quick Demo Logins */}
        <div className="mb-6 p-4 rounded-2xl glass-surface border border-[var(--glass-border)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium text-theme-muted tracking-wider">DEMO ACCOUNTS</span>
            <span className="text-[10px] text-theme-muted/60 font-mono">pw: password123</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
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
                className="py-2 px-3 rounded-xl bg-[var(--glass-hover)] hover:bg-[var(--glass-active)] border border-[var(--glass-border)] text-theme-main text-[12px] font-medium transition-all text-center active:scale-[0.97] disabled:opacity-40"
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] flex items-center gap-2.5 animate-fadeIn">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-theme-muted tracking-wider ml-1">EMAIL OR USERNAME</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-[15px] w-[15px] text-theme-muted/50" />
              </div>
              <input
                type="text"
                required
                className="w-full pl-10 pr-4 py-3 glass-input rounded-xl text-theme-main placeholder-theme-muted/40 text-[14px] focus:outline-none focus:border-accent-primary/70 focus:ring-1 focus:ring-accent-primary/30 transition-all"
                placeholder="user1@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-theme-muted tracking-wider ml-1">PASSWORD</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-[15px] w-[15px] text-theme-muted/50" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full pl-10 pr-10 py-3 glass-input rounded-xl text-theme-main placeholder-theme-muted/40 text-[14px] focus:outline-none focus:border-accent-primary/70 focus:ring-1 focus:ring-accent-primary/30 transition-all"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-theme-muted/50 hover:text-theme-main transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full mt-3 bg-accent-primary hover:bg-accent-primary/85 text-white font-medium py-3 rounded-xl transition-all shadow-glass flex justify-center items-center gap-2 disabled:opacity-40 text-[14px] active:scale-[0.98]"
          >
            {isLoggingIn ? <Loader className="animate-spin h-5 w-5" /> : "Sign In"}
          </button>
        </form>

        <div className="mt-7 text-center text-[13px] text-theme-muted border-t border-[var(--glass-border)] pt-5">
          Don't have an account?{" "}
          <Link to="/signup" className="text-accent-primary hover:underline font-medium ml-1 transition-colors">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
