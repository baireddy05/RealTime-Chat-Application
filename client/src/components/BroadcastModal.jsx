import { useEffect, useState } from "react";
import { X, Megaphone, Plus, Trash2, Send, Loader, Check, Pencil, Users } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useFriendStore } from "../store/useFriendStore";
import { useBackHandler } from "../lib/backNavigation";

const BroadcastModal = ({ onClose }) => {
  const {
    broadcasts,
    getBroadcasts,
    createBroadcast,
    updateBroadcast,
    deleteBroadcast,
    sendBroadcast,
  } = useChatStore();
  const { friends, getFriends } = useFriendStore();

  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [composerId, setComposerId] = useState(null);
  const [composerText, setComposerText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  useBackHandler(true, onClose, "broadcast");

  useEffect(() => {
    getBroadcasts();
    getFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleRecipient = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  };

  const resetForm = () => {
    setName("");
    setSelected([]);
    setEditingId(null);
    setError("");
  };

  const handleSave = async () => {
    if (!name.trim() || selected.length === 0 || isSaving) return;
    setIsSaving(true);
    setError("");
    const res = editingId
      ? await updateBroadcast(editingId, { name: name.trim(), recipientIds: selected })
      : await createBroadcast({ name: name.trim(), recipientIds: selected });
    setIsSaving(false);
    if (res.success) resetForm();
    else setError(res.error || "Could not save list");
  };

  const startEdit = (list) => {
    setEditingId(list._id);
    setName(list.name);
    setSelected((list.recipients || []).map((r) => (r._id || r).toString()));
    setError("");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this broadcast list?")) return;
    await deleteBroadcast(id);
    if (composerId === id) {
      setComposerId(null);
      setComposerText("");
    }
  };

  const handleSend = async (id) => {
    if (!composerText.trim() || isSending) return;
    setIsSending(true);
    setLastResult(null);
    const res = await sendBroadcast(id, { text: composerText.trim() });
    setIsSending(false);
    if (res.success) {
      setLastResult({ id, sent: res.sent, skipped: res.skipped });
      setComposerText("");
    } else {
      setLastResult({ id, error: res.error });
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl w-full max-w-md overflow-hidden shadow-glass animate-scaleIn text-theme-main flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-hover)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-accent-primary/15 text-accent-primary flex items-center justify-center">
              <Megaphone size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-theme-main">Broadcast Lists</h3>
              <p className="text-[11px] text-theme-muted">One message, delivered as individual DMs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {/* Create / edit form */}
          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3 space-y-2">
            <p className="text-[11px] font-bold text-theme-main">
              {editingId ? "Edit list" : "New broadcast list"}
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="List name (e.g. Team, Family)…"
              maxLength={50}
              className="w-full glass-input rounded-xl px-3 py-2 text-[13px] text-theme-main border border-[var(--glass-border)]"
            />
            <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
              {(friends || []).length === 0 && (
                <p className="text-[11px] text-theme-muted text-center py-2">No contacts yet — add contacts first.</p>
              )}
              {(friends || []).map((f) => {
                const fid = (f._id || f.id)?.toString();
                const checked = selected.includes(fid);
                return (
                  <div
                    key={fid}
                    onClick={() => toggleRecipient(fid)}
                    className={`flex items-center justify-between p-1.5 rounded-xl cursor-pointer transition-colors ${
                      checked ? "bg-accent-primary/10" : "hover:bg-[var(--glass-hover)]"
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <img
                        src={f.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.username || "User")}&background=27272a&color=ffffff`}
                        alt={f.username}
                        className="w-7 h-7 rounded-full object-cover border border-[var(--glass-border)]"
                      />
                      <span className="text-xs font-medium text-theme-main truncate">{f.username}</span>
                    </span>
                    <span
                      className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                        checked ? "bg-accent-primary border-accent-primary text-white" : "border-[var(--glass-border)]"
                      }`}
                    >
                      {checked && <Check size={12} strokeWidth={3} />}
                    </span>
                  </div>
                );
              })}
            </div>
            {error && <p className="text-[11px] text-red-400">{error}</p>}
            <div className="flex gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-theme-muted hover:bg-[var(--glass-hover)] transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={!name.trim() || selected.length === 0 || isSaving}
                className="flex-1 py-2 rounded-xl bg-accent-primary text-white text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
              >
                {isSaving ? <Loader size={13} className="animate-spin" /> : <Plus size={13} />}
                {editingId ? `Save (${selected.length})` : `Create list (${selected.length})`}
              </button>
            </div>
          </div>

          {/* Existing lists */}
          {(broadcasts || []).length === 0 ? (
            <p className="text-xs text-theme-muted text-center py-4">No broadcast lists yet.</p>
          ) : (
            (broadcasts || []).map((list) => (
              <div key={list._id} className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users size={14} className="text-accent-primary shrink-0" />
                    <span className="text-xs font-bold text-theme-main truncate">{list.name}</span>
                    <span className="text-[10px] text-theme-muted shrink-0">
                      {(list.recipients || []).length} recipients
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(list)}
                      className="p-1.5 rounded-lg text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
                      title="Edit list"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(list._id)}
                      className="p-1.5 rounded-lg text-theme-muted/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete list"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {composerId === list._id ? (
                  <div className="space-y-2">
                    <textarea
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      placeholder={`Broadcast to ${list.name}…`}
                      rows={2}
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-theme-main border border-[var(--glass-border)] resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setComposerId(null);
                          setComposerText("");
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-medium text-theme-muted hover:bg-[var(--glass-hover)] transition-colors"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSend(list._id)}
                        disabled={!composerText.trim() || isSending}
                        className="flex-1 py-2 rounded-xl bg-accent-primary text-white text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
                      >
                        {isSending ? <Loader size={13} className="animate-spin" /> : <Send size={13} />}
                        Send to {(list.recipients || []).length}
                      </button>
                    </div>
                    {lastResult?.id === list._id && (
                      <p className={`text-[11px] ${lastResult.error ? "text-red-400" : "text-emerald-500"}`}>
                        {lastResult.error ||
                          `Delivered to ${lastResult.sent}${lastResult.skipped ? ` (${lastResult.skipped} skipped — blocked)` : ""}`}
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setComposerId(list._id);
                      setComposerText("");
                      setLastResult(null);
                    }}
                    className="w-full py-2 rounded-xl text-xs font-bold text-accent-primary bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/25 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Send size={13} /> Compose broadcast
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default BroadcastModal;
