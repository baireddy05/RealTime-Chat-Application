import { useState } from "react";
import { X, Clock, BellRing, Loader } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { isEncryptedMessage } from "../lib/crypto";
import { imageSnippet } from "../lib/attachments";

const PRESETS = [
  {
    label: "In 1 hour",
    getTime: () => new Date(Date.now() + 60 * 60 * 1000),
  },
  {
    label: "Tomorrow, 9:00 AM",
    getTime: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    label: "Next Monday, 9:00 AM",
    getTime: () => {
      const d = new Date();
      const delta = ((8 - d.getDay()) % 7) || 7;
      d.setDate(d.getDate() + delta);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

const RemindModal = ({ message, onClose }) => {
  const { createReminder } = useChatStore();
  const [customDate, setCustomDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (!message) return null;

  const preview =
    message.decryptedText ||
    (isEncryptedMessage(message.text) ? "🔒 Encrypted message" : message.text) ||
    (message.image ? imageSnippet(message) : message.file ? `📎️ ${message.file.name}` : message.audio ? "🎤 Voice note" : "Message");

  const submit = async (date) => {
    if (!date || date.getTime() <= Date.now()) {
      setError("Pick a time in the future");
      return;
    }
    setIsSaving(true);
    setError("");
    const res = await createReminder(message._id, date.toISOString());
    setIsSaving(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.error || "Could not set reminder");
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl w-full max-w-sm overflow-hidden shadow-glass animate-scaleIn text-theme-main flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-hover)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center">
              <BellRing size={17} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-theme-main">Remind me</h3>
              <p className="text-[11px] text-theme-muted truncate max-w-[220px]">
                "{String(preview).slice(0, 40)}{String(preview).length > 40 ? "..." : ""}"
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={isSaving}
              onClick={() => submit(preset.getTime())}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-[var(--glass-hover)] text-theme-main text-xs font-medium transition-colors text-left disabled:opacity-50"
            >
              <Clock size={14} className="text-accent-primary shrink-0" />
              <span>{preset.label}</span>
            </button>
          ))}

          <div className="pt-2 border-t border-[var(--glass-border)]">
            <label className="block text-[10px] text-theme-muted mb-1.5 px-1">Or pick date & time:</label>
            <div className="flex gap-1.5">
              <input
                type="datetime-local"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="flex-1 min-w-0 glass-input rounded-xl px-2.5 py-1.5 text-[11px] text-theme-main border border-[var(--glass-border)]"
              />
              <button
                type="button"
                disabled={!customDate || isSaving}
                onClick={() => submit(new Date(customDate))}
                className="px-3.5 py-1.5 rounded-xl bg-accent-primary text-white text-[11px] font-medium disabled:opacity-40 flex items-center gap-1"
              >
                {isSaving && <Loader size={12} className="animate-spin" />}
                <span>Set</span>
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-red-400 px-1">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RemindModal;
