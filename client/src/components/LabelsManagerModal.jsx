import { useEffect, useState } from "react";
import { X, Plus, Trash2, Tag, Loader, Check } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useFriendStore } from "../store/useFriendStore";
import { useBackHandler } from "../lib/backNavigation";

const LabelsManagerModal = ({ onClose, focusChatId }) => {
  const { labels, chatLabels, getLabels, createLabel, deleteLabel, setChatLabels, rooms } = useChatStore();
  const { friends } = useFriendStore();
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [assignChatId, setAssignChatId] = useState(focusChatId || "");

  useBackHandler(true, onClose, "labels-manager");

  useEffect(() => {
    getLabels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (focusChatId) setAssignChatId(focusChatId);
  }, [focusChatId]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    setError("");
    const res = await createLabel({ name: name.trim() });
    setIsSaving(false);
    if (res.success) setName("");
    else setError(res.error || "Could not create label");
  };

  const toggleAssign = async (labelId) => {
    if (!assignChatId) return;
    const current = chatLabels[assignChatId] || [];
    const next = current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId];
    await setChatLabels(assignChatId, next);
  };

  const chatOptions = [
    ...(rooms || []).map((r) => ({ id: (r._id || r.id)?.toString(), name: r.name || "Group", kind: "Group" })),
    ...(friends || []).map((f) => ({ id: (f._id || f.id)?.toString(), name: f.username || "Chat", kind: "DM" })),
  ];

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

          {labels.length > 0 && (
            <div className="pt-2 border-t border-[var(--glass-border)]">
              <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider mb-1.5">Assign to chat</p>
              <select
                value={assignChatId}
                onChange={(e) => setAssignChatId(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-xs text-theme-main border border-[var(--glass-border)] mb-2"
              >
                <option value="">Select a chat...</option>
                {chatOptions.map((c) => (
                  <option key={`${c.kind}-${c.id}`} value={c.id}>
                    [{c.kind}] {c.name}
                  </option>
                ))}
              </select>
              {assignChatId && (
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((label) => {
                    const active = (chatLabels[assignChatId] || []).includes(label._id);
                    return (
                      <button
                        key={label._id}
                        type="button"
                        onClick={() => toggleAssign(label._id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${active ? "border-accent-primary bg-accent-primary/15 text-accent-primary" : "border-[var(--glass-border)] text-theme-muted"}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: label.color }} />
                        {label.name}
                        {active && <Check size={11} strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LabelsManagerModal;
