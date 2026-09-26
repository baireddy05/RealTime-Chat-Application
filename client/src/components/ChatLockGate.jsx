import { useState, useEffect, useRef, useCallback } from "react";
import { Delete, Lock } from "lucide-react";
import { verifyChatPin, hasChatPin } from "../lib/chatLock";

// Device-local PIN gate shown instead of a locked chat's contents.
// Unlocks last only for this session (cleared on logout).
// Input: on-screen keypad, physical keyboard (0-9, Backspace, Escape),
// and mobile keyboards via a hidden numeric input (tap the dots to summon).
const ChatLockGate = ({ chatName, onUnlock }) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const inputRef = useRef(null);
  const pinRef = useRef("");
  const verifyingRef = useRef(false);

  const verify = useCallback(async (value) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    const ok = await verifyChatPin(value);
    verifyingRef.current = false;
    if (ok) {
      pinRef.current = "";
      setPin("");
      onUnlock();
    } else {
      setError("Wrong PIN — try again");
      setShakeKey((k) => k + 1);
      setTimeout(() => {
        pinRef.current = "";
        setPin("");
      }, 350);
    }
  }, [onUnlock]);

  const pressDigit = useCallback((d) => {
    if (verifyingRef.current || pinRef.current.length >= 4) return;
    setError("");
    const next = (pinRef.current + d).slice(0, 4);
    pinRef.current = next;
    setPin(next);
    if (next.length === 4) {
      verify(next);
    }
  }, [verify]);

  const backspace = useCallback(() => {
    if (verifyingRef.current) return;
    setError("");
    const next = pinRef.current.slice(0, -1);
    pinRef.current = next;
    setPin(next);
  }, []);

  const clearPin = useCallback(() => {
    if (verifyingRef.current) return;
    setError("");
    pinRef.current = "";
    setPin("");
  }, []);

  const focusKeyboard = useCallback(() => {
    try {
      inputRef.current?.focus({ preventScroll: true });
    } catch {
      try {
        inputRef.current?.focus();
      } catch {}
    }
  }, []);

  // Physical keyboard: digits append, Backspace deletes, Escape clears.
  // Skipped when the hidden mobile input is focused (its onChange handles it)
  // to avoid double-entry.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target === inputRef.current) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        pressDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      } else if (e.key === "Escape") {
        e.preventDefault();
        clearPin();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pressDigit, backspace, clearPin]);

  // Summon the mobile keyboard on open (desktop browsers focus silently).
  useEffect(() => {
    const t = setTimeout(focusKeyboard, 150);
    return () => clearTimeout(t);
  }, [focusKeyboard]);

  if (!hasChatPin()) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3 select-none">
        <div className="w-14 h-14 rounded-2xl bg-[var(--glass-hover)] border border-[var(--glass-border)] flex items-center justify-center text-theme-muted">
          <Lock size={24} />
        </div>
        <p className="text-sm font-semibold text-theme-main">This chat is locked</p>
        <p className="text-xs text-theme-muted max-w-[240px]">
          This chat is locked on another device. Set the same 4-digit PIN in Settings → Privacy on this device to open it here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none gap-5">
      <div className="w-14 h-14 rounded-2xl bg-[var(--glass-hover)] border border-[var(--glass-border)] flex items-center justify-center text-accent-primary shadow-glass">
        <Lock size={24} />
      </div>
      <div>
        <p className="text-sm font-semibold text-theme-main">Locked chat</p>
        <p className="text-xs text-theme-muted mt-0.5 truncate max-w-[240px]">
          Enter your PIN to open {chatName || "this chat"}
        </p>
      </div>

      {/* Hidden input: summons mobile keyboards (Gboard/Safari) + autofill.
          Tapping the dots refocuses it. */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        enterKeyHint="done"
        aria-label="Enter 4-digit PIN"
        value=""
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 4 - pinRef.current.length);
          for (const d of digits) pressDigit(d);
          e.target.value = "";
        }}
        className="absolute w-px h-px opacity-0 pointer-events-none"
        tabIndex={-1}
      />

      <div
        key={shakeKey}
        className="flex items-center gap-3 animate-fadeIn cursor-text"
        onClick={focusKeyboard}
        title="Tap to show keyboard"
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full border transition-all ${
              i < pin.length
                ? "bg-accent-primary border-accent-primary scale-110"
                : "border-[var(--glass-border)] bg-transparent"
            }`}
          />
        ))}
      </div>
      {error && <p className="text-[11px] text-red-400 -mt-3">{error}</p>}

      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[240px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => pressDigit(d)}
            className="h-12 rounded-2xl bg-[var(--glass-hover)] border border-[var(--glass-border)] text-lg font-semibold text-theme-main hover:bg-[var(--glass-active)] active:scale-95 transition-all touch-manipulation"
          >
            {d}
          </button>
        ))}
        <span />
        <button
          type="button"
          onClick={() => pressDigit("0")}
          className="h-12 rounded-2xl bg-[var(--glass-hover)] border border-[var(--glass-border)] text-lg font-semibold text-theme-main hover:bg-[var(--glass-active)] active:scale-95 transition-all touch-manipulation"
        >
          0
        </button>
        <button
          type="button"
          onClick={backspace}
          className="h-12 rounded-2xl bg-[var(--glass-hover)] border border-[var(--glass-border)] text-theme-muted hover:text-theme-main active:scale-95 transition-all flex items-center justify-center touch-manipulation"
          title="Backspace"
        >
          <Delete size={18} />
        </button>
      </div>
      <p className="text-[10px] text-theme-muted -mt-2 hidden sm:block">
        Tip: you can also type with your keyboard
      </p>
    </div>
  );
};

export default ChatLockGate;
