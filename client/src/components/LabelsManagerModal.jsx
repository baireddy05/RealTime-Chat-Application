import { useEffect, useState } from "react";
import { X, Plus, Trash2, Tag, Loader } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useBackHandler } from "../lib/backNavigation";

const LabelsManagerModal = ({ onClose }) => {
  const { labels, getLabels, createLabel, deleteLabel } = useChatStore();
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useBackHandler(true, onClose, "labels-manager");

  useEffect(() => {
    getLabels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    setError("");
    const res = await createLabel({ name: name.trim() });
    setIsSaving(false);
    if (res.success) setName("");
    else setError(res.error || "Could not create label");
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl w-full max-w-md overflow-hidden shadow-glass animate-scaleIn text-theme-main flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-hover)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-accent-primary/15 text-accent-primary flex items-center justify-center">
              <Tag size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-theme-main">Chat Labels</h3>
              <p className="text-[11px] text-theme-muted">Organize chats into folders</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="New label (e.g. Work, Family)..."
              maxLength={30}
              className="flex-1 glass-input rounded-xl px-3 py-2 text-[13px] text-theme-main border border-[var(--glass-border)]"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={isSaving || !name.trim()}
              className="px-3.5 py-2 rounded-xl bg-accent-primary text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1"
            >
              {isSaving ? <Loader size={13} className="animate-spin" /> : <Plus size={13} />} Add
            </button>
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}

          {labels.length === 0 ? (
            <p className="text-xs text-theme-muted text-center py-6">No labels yet — create your first one above.</p>
          ) : (
            <div className="space-y-1.5">
              {labels.map((label) => (
                <div key={label._id} className="flex items-center justify-between p-2.5 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)]">
                  <span className="flex items-center gap-2 text-xs font-semibold text-theme-main">
                    <span className="w-3 h-3 rounded-full" style={{ background: label.color }} />
                    {label.name}
                  </span>
                  <button type="button" onClick={() => deleteLabel(label._id)} className="p-1.5 rounded-lg text-theme-muted/60 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete label">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-theme-muted text-center pt-1">
            Tip: tap ⋮ on any chat — or long-press it — to assign labels instantly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LabelsManagerModal;
