import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { Link } from "react-router-dom";
import { Loader, Mail, Lock, User, Eye, EyeOff, AlertCircle, Sun, Moon } from "lucide-react";

const SignUpPage = () => {
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { signup, isSigningUp } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

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
        <div className="text-center mb-7">
          <div className="w-16 h-16 rounded-2xl bg-accent-primary/20 border border-[var(--glass-border)] flex items-center justify-center mx-auto mb-5 shadow-glass text-accent-primary">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-accent-primary">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-[22px] font-semibold text-theme-main tracking-tight mb-1.5">Create account</h1>
          <p className="text-[13px] text-theme-muted">Join Pulse to start messaging</p>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] flex items-center gap-2.5 animate-fadeIn">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-theme-muted tracking-wider ml-1">USERNAME</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="h-[15px] w-[15px] text-theme-muted/50" />
              </div>
              <input
                type="text"
                required
                className="w-full pl-10 pr-4 py-3 glass-input rounded-xl text-theme-main placeholder-theme-muted/40 text-[14px] focus:outline-none focus:border-accent-primary/70 focus:ring-1 focus:ring-accent-primary/30 transition-all"
                placeholder="johndoe"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-theme-muted tracking-wider ml-1">EMAIL ADDRESS</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-[15px] w-[15px] text-theme-muted/50" />
              </div>
              <input
                type="email"
                required
                className="w-full pl-10 pr-4 py-3 glass-input rounded-xl text-theme-main placeholder-theme-muted/40 text-[14px] focus:outline-none focus:border-accent-primary/70 focus:ring-1 focus:ring-accent-primary/30 transition-all"
                placeholder="name@example.com"
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
            disabled={isSigningUp}
            className="w-full mt-3 bg-accent-primary hover:bg-accent-primary/85 text-white font-medium py-3 rounded-xl transition-all shadow-glass flex justify-center items-center gap-2 disabled:opacity-40 text-[14px] active:scale-[0.98]"
          >
            {isSigningUp ? <Loader className="animate-spin h-5 w-5" /> : "Create Account"}
          </button>
        </form>

        <div className="mt-7 text-center text-[13px] text-theme-muted border-t border-[var(--glass-border)] pt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-accent-primary hover:underline font-medium ml-1 transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
