import { useState } from "react";
import { Delete, Lock } from "lucide-react";
import { verifyChatPin, hasChatPin } from "../lib/chatLock";

// Device-local PIN gate shown instead of a locked chat's contents.
// Unlocks last only for this session (cleared on logout).
const ChatLockGate = ({ chatName, onUnlock }) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  if (!hasChatPin()) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3 select-none">
        <div className="w-14 h-14 rounded-2xl bg-[var(--glass-hover)] border border-[var(--glass-border)] flex items-center justify-center text-theme-muted">
          <Lock size={24} />
        </div>
        <p className="text-sm font-semibold text-theme-main">This chat is locked</p>
        <p className="text-xs text-theme-muted max-w-[240px]">
          No chat lock PIN is set on this device. Set one in Settings → Privacy to open locked chats.
        </p>
      </div>
    );
  }

  const pressDigit = (d) => {
    if (verifying || pin.length >= 4) return;
    setError("");
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      verify(next);
    }
  };

  const verify = async (value) => {
    setVerifying(true);
    const ok = await verifyChatPin(value);
    setVerifying(false);
    if (ok) {
      setPin("");
      onUnlock();
    } else {
      setError("Wrong PIN — try again");
      setShakeKey((k) => k + 1);
      setTimeout(() => setPin(""), 350);
    }
  };

  const backspace = () => {
    setError("");
    setPin((p) => p.slice(0, -1));
  };

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

      <div key={shakeKey} className="flex items-center gap-3 animate-fadeIn">
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
            className="h-12 rounded-2xl bg-[var(--glass-hover)] border border-[var(--glass-border)] text-lg font-semibold text-theme-main hover:bg-[var(--glass-active)] active:scale-95 transition-all"
          >
            {d}
          </button>
        ))}
        <span />
        <button
          type="button"
          onClick={() => pressDigit("0")}
          className="h-12 rounded-2xl bg-[var(--glass-hover)] border border-[var(--glass-border)] text-lg font-semibold text-theme-main hover:bg-[var(--glass-active)] active:scale-95 transition-all"
        >
          0
        </button>
        <button
          type="button"
          onClick={backspace}
          className="h-12 rounded-2xl bg-[var(--glass-hover)] border border-[var(--glass-border)] text-theme-muted hover:text-theme-main active:scale-95 transition-all flex items-center justify-center"
          title="Backspace"
        >
          <Delete size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatLockGate;
