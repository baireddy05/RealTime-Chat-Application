import { useState } from "react";
import { X, Ticket, Loader, Check } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useBackHandler } from "../lib/backNavigation";

const JoinGroupModal = ({ onClose, onJoined }) => {
  const { joinGroupByCode, setSelectedChat } = useChatStore();
  const [code, setCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  useBackHandler(true, onClose, "join-group");

  const handleJoin = async () => {
    const clean = code.trim();
    if (!clean || isJoining) return;
    setIsJoining(true);
    setError("");
    const res = await joinGroupByCode(clean);
    setIsJoining(false);
    if (res.success && res.room) {
      const room = res.room;
      setSelectedChat({
        id: room._id,
        _id: room._id,
        name: room.name,
        type: "room",
        description: room.description,
        members: room.members,
        createdBy: room.createdBy,
        admins: room.admins,
        avatar: room.avatar,
        profilePic: room.profilePic,
      });
      onJoined?.(room);
      onClose();
    } else {
      setError(res.error || "Could not join group");
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl w-full max-w-sm overflow-hidden shadow-glass animate-scaleIn text-theme-main"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-hover)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-accent-primary/15 text-accent-primary flex items-center justify-center">
              <Ticket size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-theme-main">Join Group</h3>
              <p className="text-[11px] text-theme-muted">Enter the invite code shared by an admin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="Paste invite code…"
            autoFocus
            spellCheck={false}
            className="w-full glass-input rounded-xl px-3 py-2.5 text-sm font-mono text-center tracking-wider text-theme-main border border-[var(--glass-border)]"
          />
          {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}
          <button
            type="button"
            onClick={handleJoin}
            disabled={!code.trim() || isJoining}
            className="w-full py-2.5 rounded-2xl bg-accent-primary text-white text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
          >
            {isJoining ? <Loader size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
            Join Group
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinGroupModal;
