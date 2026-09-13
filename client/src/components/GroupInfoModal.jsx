import { useState } from "react";
import { X, Users, Hash, Shield, ShieldCheck, UserMinus, Edit2, Check, Loader } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const GroupInfoModal = ({ group, onClose, onSelectUser }) => {
  const { authUser, onlineUsers } = useAuthStore();
  const { updateGroupInfo, kickGroupMember, toggleGroupAdmin } = useChatStore();

  const members = group.members || [];
  const displayName = group.name.replace(/^#/, "");
  const myId = authUser?._id;

  const isCreator = group.createdBy && (group.createdBy._id === myId || group.createdBy === myId);
  const admins = group.admins || (group.createdBy ? [group.createdBy] : []);
  const amIAdmin = isCreator || admins.some((a) => (a._id || a) === myId);

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(displayName);
  const [editedDesc, setEditedDesc] = useState(group.description || "");
  const [isSaving, setIsSaving] = useState(false);
  const [loadingMemberId, setLoadingMemberId] = useState(null);

  const handleSaveInfo = async () => {
    if (!editedName.trim()) return;
    setIsSaving(true);
    await updateGroupInfo(group._id, {
      name: editedName.trim(),
      description: editedDesc.trim(),
    });
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleKickMember = async (memberId) => {
    if (window.confirm("Are you sure you want to remove this member from the channel?")) {
      setLoadingMemberId(memberId);
      await kickGroupMember(group._id, memberId);
      setLoadingMemberId(null);
    }
  };

  const handleToggleAdmin = async (memberId) => {
    setLoadingMemberId(memberId);
    await toggleGroupAdmin(group._id, memberId);
    setLoadingMemberId(null);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl w-full max-w-md overflow-hidden shadow-glass animate-scaleIn text-theme-main flex flex-col max-h-[85vh]"
      >
        {/* Banner / Header */}
        <div className="relative p-6 bg-[var(--glass-hover)] border-b border-[var(--glass-border)] text-center flex flex-col items-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            <X size={16} />
          </button>

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-primary/30 to-accent-secondary/30 flex items-center justify-center text-accent-primary font-semibold text-xl shadow-glass border border-[var(--glass-border)] mb-2.5">
            {displayName.slice(0, 2).toUpperCase()}
          </div>

          {isEditing ? (
            <div className="w-full space-y-2 mt-1">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Channel Name"
                className="w-full glass-input rounded-xl px-3 py-1.5 text-center font-semibold text-[14px] text-theme-main border border-[var(--glass-border)]"
              />
              <textarea
                value={editedDesc}
                onChange={(e) => setEditedDesc(e.target.value)}
                placeholder="Channel Description"
                rows={2}
                className="w-full glass-input rounded-xl px-3 py-1 text-center text-xs text-theme-muted border border-[var(--glass-border)] resize-none"
              />
              <div className="flex justify-center gap-2 pt-1">
                <button
                  onClick={handleSaveInfo}
                  disabled={isSaving || !editedName.trim()}
                  className="px-3 py-1 rounded-lg bg-accent-primary text-white text-xs font-medium flex items-center gap-1"
                >
                  {isSaving ? <Loader size={12} className="animate-spin" /> : <Check size={12} />}
                  <span>Save</span>
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 rounded-lg bg-[var(--glass-hover)] text-theme-muted hover:text-theme-main text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <h3 className="text-lg font-semibold capitalize text-theme-main flex items-center gap-1.5">
                  <Hash size={16} className="text-accent-primary" />
                  <span>{displayName}</span>
                </h3>
                {amIAdmin && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1 text-theme-muted hover:text-accent-primary rounded-md transition-colors"
                    title="Edit Channel Details"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
              </div>

              <p className="text-xs text-theme-muted mt-1 max-w-xs">
                {group.description || "Community Channel"}
              </p>
            </>
          )}

          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-accent-primary/15 border border-accent-primary/30 text-accent-primary text-[11px] font-medium">
            <Users size={12} />
            <span>{members.length} {members.length === 1 ? "Member" : "Members"}</span>
          </div>
        </div>

        {/* Member list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <span className="text-[10px] font-medium text-theme-muted uppercase tracking-wider block px-1">
            Members & Roles ({members.length})
          </span>

          <div className="space-y-1">
            {members.length === 0 ? (
              <div className="py-6 text-center text-xs text-theme-muted">
                All team members have access to this channel.
              </div>
            ) : (
              members.map((member) => {
                const memberId = member._id || member;
                const username = member.username || "Member";
                const isOnline = onlineUsers.includes(memberId);
                const isThisMemberCreator = group.createdBy && (group.createdBy._id === memberId || group.createdBy === memberId);
                const isThisMemberAdmin = isThisMemberCreator || admins.some((a) => (a._id || a) === memberId);
                const isMe = memberId === myId;
                const isLoading = loadingMemberId === memberId;

                return (
                  <div
                    key={memberId}
                    className="flex items-center justify-between p-2 rounded-xl bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] transition-colors border border-[var(--glass-border)]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative flex-shrink-0">
                        <img
                          src={
                            member.profilePic ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(username || "User")}&background=2563eb&color=ffffff`
                          }
                          alt={username}
                          className="w-8 h-8 rounded-full object-cover border border-[var(--glass-border)]"
                        />
                        {isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-status-online ring-2 ring-[var(--glass-surface)]" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-medium text-theme-main truncate flex items-center gap-1.5">
                          <span>{username}</span>
                          {isThisMemberAdmin && (
                            <span className="text-[9px] bg-amber-400/20 text-amber-400 border border-amber-400/30 px-1.5 py-0.2 rounded-full font-medium flex items-center gap-0.5">
                              <Shield size={9} />
                              {isThisMemberCreator ? "Owner" : "Admin"}
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-theme-muted truncate">
                          {isOnline ? "Online" : "Offline"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Admin actions if viewer is creator or admin and target is not creator */}
                      {amIAdmin && !isThisMemberCreator && !isMe && (
                        <>
                          {isCreator && (
                            <button
                              onClick={() => handleToggleAdmin(memberId)}
                              disabled={isLoading}
                              className={`p-1.5 rounded-lg transition-colors text-xs ${
                                isThisMemberAdmin
                                  ? "text-amber-400 hover:bg-amber-400/15"
                                  : "text-theme-muted hover:text-amber-400 hover:bg-[var(--glass-hover)]"
                              }`}
                              title={isThisMemberAdmin ? "Revoke Admin Role" : "Make Channel Admin"}
                            >
                              <ShieldCheck size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleKickMember(memberId)}
                            disabled={isLoading}
                            className="p-1.5 rounded-lg text-theme-muted hover:text-red-400 hover:bg-red-500/15 transition-colors"
                            title="Remove from Channel"
                          >
                            <UserMinus size={14} />
                          </button>
                        </>
                      )}

                      {onSelectUser && !isMe && (
                        <button
                          onClick={() => {
                            onSelectUser({ id: memberId, type: "user", name: username });
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-lg text-accent-primary hover:bg-accent-primary/20 text-xs font-medium transition-colors"
                          title="Direct Message"
                        >
                          Message
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[var(--glass-border)] bg-[var(--glass-hover)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-medium text-theme-muted hover:text-theme-main bg-[var(--glass-surface)] hover:bg-[var(--glass-active)] border border-[var(--glass-border)] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupInfoModal;
