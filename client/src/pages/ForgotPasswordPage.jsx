import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import PulseLogo from "../components/PulseLogo";
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
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

const ForgotPasswordPage = () => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
  const [identifier, setIdentifier] = useState("");
  const [resolvedEmail, setResolvedEmail] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devOtp, setDevOtp] = useState("");
  const [hasSmtp, setHasSmtp] = useState(true);

  const { requestPasswordResetOtp, verifyPasswordResetOtp, resetPasswordWithOtp } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  // Desktop interactive mouse spotlight
  const [mouseState, setMouseState] = useState({
    x: 0,
    y: 0,
    nx: 0,
    ny: 0,
    isHovering: false,
  });
  const leftPanelRef = useRef(null);
  const otpInputRefs = useRef([]);

  // Resend cooldown timer
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

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

  // Step 1: Request OTP
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    const cleanInput = identifier.trim();
    if (!cleanInput) {
      setErrorMessage("Please enter your registered email address or username.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await requestPasswordResetOtp(cleanInput);
      setResolvedEmail(res.email);
      setMaskedEmail(res.maskedEmail || res.email);
      setDevOtp(res.devOtp || "");
      setHasSmtp(res.hasSmtp !== false);
      setStep(2);
      setResendCooldown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || err?.message || "Failed to send verification code. Please verify your details.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Handle OTP input changes
  const handleOtpChange = (index, value) => {
    // Only accept numeric characters
    const cleaned = value.replace(/[^0-9]/g, "");
    if (!cleaned) {
      const newDigits = [...otpDigits];
      newDigits[index] = "";
      setOtpDigits(newDigits);
      return;
    }

    // Handle paste of full 6-digit code
    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, 6).split("");
      const newDigits = [...otpDigits];
      pasted.forEach((char, i) => {
        newDigits[i] = char;
      });
      setOtpDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = cleaned[0];
    setOtpDigits(newDigits);

    // Auto-advance to next box
    if (index < 5 && cleaned[0]) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");
    const enteredOtp = otpDigits.join("");
    if (enteredOtp.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    try {
      await verifyPasswordResetOtp(resolvedEmail, enteredOtp);
      setStep(3);
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || err?.message || "Invalid or expired verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Complete Password Reset
  const handleResetPassword = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    setIsLoading(true);
    try {
      const enteredOtp = otpDigits.join("");
      await resetPasswordWithOtp(resolvedEmail, enteredOtp, newPassword);
      setStep(4);
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || err?.message || "Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-[rgb(var(--bg-app-rgb))] overflow-hidden select-none font-sans relative">
      {/* ── Top Header Navigation Bar ── */}
      <div className="absolute top-4 left-4 right-4 sm:top-5 sm:left-6 sm:right-6 flex items-center justify-between z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <Link
            to="/login"
            className="p-2 sm:p-2.5 rounded-full glass-input hover:bg-[var(--glass-active)] text-theme-muted hover:text-theme-main transition-all active:scale-90 cursor-pointer shadow-sm border border-black/10 dark:border-white/10 flex items-center gap-1.5 text-xs font-semibold"
            title="Back to Sign In"
          >
            <ArrowLeft size={16} />
            <span>Sign In</span>
          </Link>
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

      {/* ── Desktop Left Panel: Interactive Visual Experience ── */}
      <div
        ref={leftPanelRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="hidden lg:flex w-[55%] relative items-center justify-center overflow-hidden apple-ambient-bg cursor-default"
        style={{ perspective: "1200px" }}
      >
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-500 z-0"
          style={{
            opacity: mouseState.isHovering ? 1 : 0.6,
            background: mouseState.isHovering
              ? `radial-gradient(650px circle at ${mouseState.x}px ${mouseState.y}px, rgba(0, 240, 255, 0.20), rgba(0, 255, 157, 0.12), rgba(0, 240, 255, 0.05), transparent 70%)`
              : "radial-gradient(600px circle at 50% 50%, rgba(0, 240, 255, 0.14), rgba(0, 255, 157, 0.08), transparent 70%)",
          }}
        />

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

        {/* 3D Card */}
        <div
          className="relative z-10 flex flex-col items-center justify-center text-center p-10 max-w-xl transition-transform duration-200 ease-out"
          style={{
            transform: `rotateY(${mouseState.nx * 14}deg) rotateX(${-mouseState.ny * 14}deg) translateZ(30px)`,
            transformStyle: "preserve-3d",
          }}
        >
          <div className="relative group mb-8">
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-400/40 via-emerald-400/30 to-cyan-500/40 rounded-[3rem] blur-2xl group-hover:blur-3xl transition-all duration-500 opacity-80" />
            <div className="relative w-36 h-36 flex items-center justify-center transition-all duration-500 group-hover:scale-105">
              <PulseLogo
                alt="Pulse Logo"
                className="w-full h-full object-contain drop-shadow-[0_8px_20px_rgba(0,240,255,0.3)] transition-transform duration-500 group-hover:scale-110"
              />
            </div>
          </div>

          <h1 className="text-4xl font-extrabold text-theme-main tracking-tight mb-4 leading-tight">
            Account Recovery <br />
            with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-400">
              Pulse
            </span>
          </h1>

          <p className="text-base text-theme-muted max-w-md mx-auto leading-relaxed font-normal">
            Safely verify your identity with a secure one-time passcode sent directly to your email inbox.
          </p>

          <div className="mt-8 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 dark:bg-white/[0.04] border border-white/15 dark:border-white/10 backdrop-blur-md">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-theme-muted font-medium tracking-wide">
              Cryptographically Salted & Encrypted
            </span>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Recovery Steps Form ── */}
      <div className="w-full lg:w-[45%] h-full flex flex-col z-20 glass-surface shadow-[-20px_0_40px_rgba(0,0,0,0.05)] border-l border-[var(--glass-border)] bg-[rgb(var(--bg-app-rgb))]">
        <div className="flex-1 overflow-y-auto flex flex-col justify-center px-5 sm:px-10 md:px-14 lg:px-20 py-16 sm:py-12">
          <div className="w-full max-w-[420px] mx-auto animate-slide-up">
            
            {/* Mobile Header with Logo */}
            <div className="flex items-center gap-3 mb-6 lg:hidden justify-center">
              <PulseLogo className="w-12 h-12 object-contain drop-shadow" />
              <span className="text-2xl font-extrabold tracking-tight text-theme-main">Pulse</span>
            </div>

            {/* Stepper Header Indicator */}
            {step < 4 && (
              <div className="flex items-center justify-between mb-8 px-2">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        step === s
                          ? "bg-gradient-to-r from-cyan-400 to-emerald-400 text-black font-extrabold shadow-[0_0_15px_rgba(0,240,255,0.4)] scale-110"
                          : step > s
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : "glass-input text-theme-muted border border-white/10"
                      }`}
                    >
                      {step > s ? <CheckCircle2 size={16} /> : s}
                    </div>
                    {s < 3 && (
                      <div
                        className={`h-[2px] flex-1 mx-2 transition-all ${
                          step > s ? "bg-emerald-400/50" : "bg-white/10 dark:bg-white/5"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm flex items-start gap-3 animate-fade-in">
                <AlertCircle size={18} className="text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            {/* ────────── STEP 1: Enter Email or Username ────────── */}
            {step === 1 && (
              <div>
                <div className="mb-8 text-center lg:text-left">
                  <h2 className="text-3xl font-extrabold text-theme-main tracking-tight mb-2">Forgot Password?</h2>
                  <p className="text-theme-muted text-sm leading-relaxed">
                    No worries! Enter your email or username and we'll send a 6-digit OTP code to verify your account.
                  </p>
                </div>

                <form onSubmit={handleRequestOtp} noValidate className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-theme-muted tracking-wider uppercase">
                      Email or Username
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="size-5 text-theme-muted group-focus-within:text-accent-primary transition-colors" />
                      </div>
                      <input
                        type="text"
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl glass-input text-theme-main placeholder:text-theme-muted/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all border border-black/10 dark:border-white/10"
                        placeholder="name@example.com or username"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        autoComplete="username"
                        autoFocus
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 px-6 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] font-bold text-sm shadow-xl active:scale-[0.98] hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="size-5 animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4 text-cyan-400" />
                        <span>Send Verification Code</span>
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <p className="text-sm text-theme-muted">
                    Remembered your password?{" "}
                    <Link to="/login" className="font-semibold text-theme-main hover:underline">
                      Back to Sign In
                    </Link>
                  </p>
                </div>
              </div>
            )}

            {/* ────────── STEP 2: Enter 6-Digit OTP ────────── */}
            {step === 2 && (
              <div>
                <div className="mb-6 text-center lg:text-left">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-3">
                    <KeyRound size={13} />
                    <span>Check your email</span>
                  </div>
                  <h2 className="text-3xl font-extrabold text-theme-main tracking-tight mb-2">Enter Verification Code</h2>
                  <p className="text-theme-muted text-sm leading-relaxed">
                    We sent a 6-digit code to <strong className="text-theme-main font-semibold">{maskedEmail}</strong>. Enter it below to continue.
                  </p>

                  {devOtp ? (
                    <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-500 dark:text-amber-300 text-xs flex flex-col gap-2 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5 text-xs text-theme-main">
                          <Sparkles size={14} className="text-amber-400" />
                          <span>Dev Code:</span>
                          <strong className="text-base font-mono tracking-widest text-amber-400">{devOtp}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setOtpDigits(devOtp.split(""));
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-[11px] transition-all cursor-pointer"
                        >
                          Auto-fill
                        </button>
                      </div>
                      <span className="text-theme-muted text-[10.5px] leading-tight">
                        No SMTP email configured in .env yet. To send real emails to your Gmail inbox, add SMTP_USER & SMTP_PASS in server/.env.
                      </span>
                    </div>
                  ) : !hasSmtp ? (
                    <div className="mt-3 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-theme-muted text-xs">
                      <span>💡 <strong>Local Dev Note:</strong> Check your server terminal window where the OTP code is printed.</span>
                    </div>
                  ) : null}
                </div>

                <form onSubmit={handleVerifyOtp} noValidate className="space-y-6">
                  {/* 6 Digit Input Group */}
                  <div className="flex items-center justify-between gap-2 sm:gap-3 py-2">
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-extrabold rounded-2xl glass-input text-theme-main focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-cyan-400 border border-black/10 dark:border-white/10 transition-all selection:bg-transparent"
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || otpDigits.join("").length !== 6}
                    className="w-full py-4 px-6 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] font-bold text-sm shadow-xl active:scale-[0.98] hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="size-5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Verify Code</span>
                    )}
                  </button>

                  {/* Resend and Edit Email Controls */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-theme-muted">
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || isLoading}
                      onClick={handleRequestOtp}
                      className="flex items-center gap-1.5 font-semibold text-theme-main hover:text-cyan-400 transition-colors disabled:opacity-50 disabled:hover:text-theme-muted cursor-pointer"
                    >
                      <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
                      {resendCooldown > 0 ? (
                        <span>Resend code in {resendCooldown}s</span>
                      ) : (
                        <span>Resend OTP Code</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        setErrorMessage("");
                      }}
                      className="hover:underline cursor-pointer"
                    >
                      Change email or username
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ────────── STEP 3: Enter New Password ────────── */}
            {step === 3 && (
              <div>
                <div className="mb-6 text-center lg:text-left">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
                    <ShieldCheck size={13} />
                    <span>Identity Verified</span>
                  </div>
                  <h2 className="text-3xl font-extrabold text-theme-main tracking-tight mb-2">Create New Password</h2>
                  <p className="text-theme-muted text-sm leading-relaxed">
                    Choose a strong password with at least 6 characters to secure your account.
                  </p>
                </div>

                <form onSubmit={handleResetPassword} noValidate className="space-y-5">
                  {/* New Password */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-theme-muted tracking-wider uppercase">
                      New Password
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="size-5 text-theme-muted group-focus-within:text-accent-primary transition-colors" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        className="w-full pl-11 pr-11 py-3.5 rounded-2xl glass-input text-theme-main placeholder:text-theme-muted/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all border border-black/10 dark:border-white/10"
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        autoFocus
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

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-theme-muted tracking-wider uppercase">
                      Confirm New Password
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="size-5 text-theme-muted group-focus-within:text-accent-primary transition-colors" />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        className="w-full pl-11 pr-11 py-3.5 rounded-2xl glass-input text-theme-main placeholder:text-theme-muted/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all border border-black/10 dark:border-white/10"
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-theme-muted hover:text-theme-main transition-colors cursor-pointer"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5 text-theme-muted/50" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Match Indicator */}
                  {confirmPassword && (
                    <div className="flex items-center gap-1.5 text-xs">
                      {newPassword === confirmPassword ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle2 size={13} /> Passwords match
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1">
                          <AlertCircle size={13} /> Passwords do not match
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
                    className="w-full py-4 px-6 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] font-bold text-sm shadow-xl active:scale-[0.98] hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="size-5 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <span>Save & Update Password</span>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* ────────── STEP 4: Success Confirmation ────────── */}
            {step === 4 && (
              <div className="text-center py-4 animate-scale-up">
                <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 border-2 border-emerald-400/40 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.25)]">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>

                <h2 className="text-3xl font-extrabold text-theme-main tracking-tight mb-3">
                  Password Reset Complete!
                </h2>

                <p className="text-theme-muted text-sm leading-relaxed max-w-sm mx-auto mb-8">
                  Your Pulse Messenger account password has been safely updated. You can now sign in with your new credentials.
                </p>

                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-black font-extrabold text-sm shadow-[0_4px_25px_rgba(0,240,255,0.3)] active:scale-[0.98] hover:brightness-105 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Sign In with New Password</span>
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
