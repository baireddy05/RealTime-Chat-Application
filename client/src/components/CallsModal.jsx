import { useEffect } from "react";
import { X, Phone, Video, PhoneMissed, PhoneIncoming, PhoneOutgoing, Trash2, Loader, History } from "lucide-react";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";
import { useBackHandler } from "../lib/backNavigation";
import { soundManager } from "../lib/sound";

const formatDuration = (secs) => {
  if (!secs || secs <= 0) return "";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const formatTime = (d) => {
  try {
    const date = new Date(d);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

const CallsModal = ({ onClose }) => {
  const { callHistory, isCallHistoryLoading, getCallHistory, clearCallHistory, startCall } = useCallStore();
  const { authUser } = useAuthStore();

  useBackHandler(true, onClose, "calls-history");

  useEffect(() => {
    getCallHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClear = async () => {
    if (!window.confirm("Clear your entire call history? The other side keeps theirs.")) return;
    await clearCallHistory();
  };

  const handleRedial = (log) => {
    const myId = authUser?._id?.toString();
    const other = (log.callerId?._id || log.callerId)?.toString() === myId ? log.receiverId : log.callerId;
    if (!other?._id && !other) return;
    const otherId = other._id || other;
    soundManager.initContext();
    startCall({
      targetUser: {
        _id: otherId,
        id: otherId,
        name: other.username || "User",
        username: other.username || "User",
        profilePic: other.profilePic || "",
        authName: authUser?.username,
      },
      callType: log.callType || "video",
    });
    onClose();
  };

  const describe = (log) => {
    const myId = authUser?._id?.toString();
    const outgoing = (log.callerId?._id || log.callerId)?.toString() === myId;
    switch (log.status) {
      case "missed":
        return { label: "Missed", Icon: PhoneMissed, tone: "text-red-400" };
      case "rejected":
        return { label: outgoing ? "Declined" : "You declined", Icon: PhoneMissed, tone: "text-red-400" };
      case "cancelled":
        return { label: "Cancelled", Icon: PhoneOutgoing, tone: "text-theme-muted" };
      default:
        return {
          label: outgoing ? "Outgoing" : "Incoming",
          Icon: outgoing ? PhoneOutgoing : PhoneIncoming,
          tone: "text-emerald-500",
        };
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
              <History size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-theme-main">Call History</h3>
              <p className="text-[11px] text-theme-muted">Recent audio & video calls</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {(callHistory || []).length > 0 && (
              <button
                onClick={handleClear}
                className="p-1.5 rounded-full text-theme-muted/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Clear history"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
          {isCallHistoryLoading && (callHistory || []).length === 0 ? (
            <div className="flex items-center justify-center py-14 gap-2 text-theme-muted">
              <Loader size={18} className="animate-spin text-accent-primary" />
              <span className="text-xs">Loading calls…</span>
            </div>
          ) : (callHistory || []).length === 0 ? (
            <div className="text-center py-14 text-theme-muted px-6">
              <Phone size={26} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium text-theme-main">No calls yet</p>
              <p className="text-xs mt-1">Your recent calls will appear here.</p>
            </div>
          ) : (
            (callHistory || []).map((log) => {
              const myId = authUser?._id?.toString();
              const outgoing = (log.callerId?._id || log.callerId)?.toString() === myId;
              const other = outgoing ? log.receiverId : log.callerId;
              const { label, Icon, tone } = describe(log);
              return (
                <div
                  key={log._id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={
                          other?.profilePic ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(other?.username || "User")}&background=27272a&color=ffffff`
                        }
                        alt={other?.username}
                        className="w-9 h-9 rounded-full object-cover border border-[var(--glass-border)]"
                      />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-[var(--glass-surface)] ${tone} bg-[var(--glass-surface)]`}>
                        <Icon size={10} strokeWidth={3} />
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-theme-main truncate">{other?.username || "User"}</p>
                      <p className={`text-[10px] truncate flex items-center gap-1 ${tone}`}>
                        <span>{label}</span>
                        <span className="text-theme-muted">•</span>
                        <span className="text-theme-muted">{log.callType === "audio" ? "Voice" : "Video"}</span>
                        {log.durationSec > 0 && (
                          <>
                            <span className="text-theme-muted">•</span>
                            <span className="text-theme-muted font-mono">{formatDuration(log.durationSec)}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-theme-muted font-mono">{formatTime(log.startedAt)}</span>
                    <button
                      type="button"
                      onClick={() => handleRedial(log)}
                      className="p-2 rounded-full bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25 transition-colors"
                      title={`Call back (${log.callType})`}
                    >
                      {log.callType === "audio" ? <Phone size={14} /> : <Video size={14} />}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CallsModal;
