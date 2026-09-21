import { useEffect, useState } from "react";
import { X, Loader, Phone, Video, Mail, Info, Users, Ban, Flag, MessageCircle } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";
import { useFriendStore } from "../store/useFriendStore";
import { soundManager } from "../lib/sound";
import { useBackHandler } from "../lib/backNavigation";

// WhatsApp-style contact details: identity, presence, shared groups and
// quick actions. Opened by tapping a person's name/avatar in the chat header.
const ContactInfoModal = ({ userId, onClose }) => {
  const { authUser, onlineUsers } = useAuthStore();
  const { rooms, setSelectedChat } = useChatStore();
  const { startCall } = useCallStore();
  const { blockUser, reportUser } = useFriendStore();

  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useBackHandler(true, onClose, "contact-info");

  useEffect(() => {
    let active = true;
    const fetchProfile = async () => {
      if (!userId) return;
      setIsLoading(true);
      setError("");
      try {
        const res = await axiosInstance.get(`/auth/user/${userId}`);
        if (active) setProfile(res.data);
      } catch (err) {
        if (active) {
          setError(err.response?.data?.message || "Could not load profile");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchProfile();
    return () => {
      active = false;
    };
  }, [userId]);

  if (!userId) return null;

  const isOnline = (onlineUsers || []).includes(userId?.toString());
  const displayName = profile?.username || "Contact";

  const handleStartCall = (type) => {
    if (!profile) return;
    soundManager.initContext();
    startCall({
      targetUser: {
        _id: profile._id,
        id: profile._id,
        name: profile.username,
        username: profile.username,
        profilePic: profile.profilePic || "",
        authName: authUser?.username,
      },
      callType: type,
    });
    onClose();
  };

  const handleOpenGroup = (group) => {
    const room = (rooms || []).find((r) => (r._id || r.id)?.toString() === group._id?.toString());
    if (!room) return;
    setSelectedChat({
      id: room._id || room.id,
      _id: room._id || room.id,
      name: room.name,
      type: "room",
      description: room.description,
      members: room.members,
      createdBy: room.createdBy,
      admins: room.admins,
      avatar: room.avatar,
      profilePic: room.profilePic,
    });
    onClose();
  };

  const handleBlock = async () => {
    if (!window.confirm(`Block ${displayName}? You will stop receiving their messages and they won't see you online.`)) return;
    setActionLoading(true);
    await blockUser(profile._id);
    setActionLoading(false);
    onClose();
  };

  const handleReport = async () => {
    const reason = window.prompt(`Report ${displayName} for spam or abuse (optional reason):`, "");
    if (reason === null) return;
    setActionLoading(true);
    await reportUser(profile._id, reason);
    setActionLoading(false);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl w-full max-w-sm overflow-hidden shadow-glass animate-scaleIn text-theme-main flex flex-col max-h-[85vh]"
      >
        {/* Banner */}
        <div className="relative px-5 pt-6 pb-5 bg-[var(--glass-hover)] border-b border-[var(--glass-border)] flex flex-col items-center text-center">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            <X size={16} />
          </button>
          <div className="relative">
            {isLoading || !profile ? (
              <div className="w-20 h-20 rounded-full bg-[var(--glass-hover)] border border-[var(--glass-border)] flex items-center justify-center">
                <Loader size={22} className="animate-spin text-theme-muted" />
              </div>
            ) : (
              <img
                src={
                  profile.profilePic ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=27272a&color=ffffff&bold=true`
                }
                alt={displayName}
                className="w-20 h-20 rounded-full object-cover border border-[var(--glass-border)] shadow-lg"
              />
            )}
            {!isLoading && profile && (
              <span
                className={`absolute bottom-1 right-1 w-4 h-4 rounded-full ring-2 ring-[var(--glass-heavy)] ${
                  isOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-zinc-400 dark:bg-zinc-600"
                }`}
              />
            )}
          </div>
          <h3 className="mt-2.5 text-base font-bold text-theme-main">
            {isLoading ? "Loading…" : displayName}
          </h3>
          {!isLoading && profile && (
            <p className={`text-[11px] font-medium ${isOnline ? "text-emerald-500" : "text-theme-muted"}`}>
              {isOnline ? "online" : "offline"}
            </p>
          )}
          {!isLoading && profile && (
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => handleStartCall("audio")}
                title="Voice call"
                className="w-10 h-10 rounded-full bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25 flex items-center justify-center transition-colors"
              >
                <Phone size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleStartCall("video")}
                title="Video call"
                className="w-10 h-10 rounded-full bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25 flex items-center justify-center transition-colors"
              >
                <Video size={16} />
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Message"
                className="w-10 h-10 rounded-full bg-accent-primary text-white hover:opacity-90 flex items-center justify-center transition-opacity shadow-md"
              >
                <MessageCircle size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
          {error ? (
            <p className="text-xs text-red-400 text-center py-6">{error}</p>
          ) : (
            profile && (
              <>
                {profile.status && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)]">
                    <Info size={15} className="text-accent-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted">Status</p>
                      <p className="text-xs text-theme-main break-words">{profile.status}</p>
                    </div>
                  </div>
                )}
                {profile.bio && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)]">
                    <MessageCircle size={15} className="text-accent-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted">About</p>
                      <p className="text-xs text-theme-main break-words">{profile.bio}</p>
                    </div>
                  </div>
                )}
                {profile.email && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)]">
                    <Mail size={15} className="text-accent-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted">Email</p>
                      <p className="text-xs text-theme-main truncate font-mono">{profile.email}</p>
                    </div>
                  </div>
                )}

                {(profile.sharedGroups || []).length > 0 && (
                  <div className="p-3 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)]">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted mb-2 flex items-center gap-1.5">
                      <Users size={12} /> Groups in common ({profile.sharedGroups.length})
                    </p>
                    <div className="space-y-1">
                      {profile.sharedGroups.map((g) => (
                        <button
                          key={g._id}
                          type="button"
                          onClick={() => handleOpenGroup(g)}
                          className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-[var(--glass-hover)] transition-colors text-left"
                        >
                          <span className="w-8 h-8 rounded-xl bg-[var(--glass-hover)] border border-[var(--glass-border)] flex items-center justify-center text-theme-muted shrink-0">
                            <Users size={14} />
                          </span>
                          <span className="text-xs font-semibold text-theme-main truncate">
                            {(g.name || "Group").replace(/^#/, "")}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!profile.isSelf && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleBlock}
                      disabled={actionLoading}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 border border-red-500/20"
                    >
                      <Ban size={13} /> Block
                    </button>
                    <button
                      type="button"
                      onClick={handleReport}
                      disabled={actionLoading}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 border border-red-500/20"
                    >
                      <Flag size={13} /> Report
                    </button>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactInfoModal;
