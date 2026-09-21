import { useEffect, useState } from "react";
import { X, Users, Hash, Shield, ShieldCheck, UserMinus, UserPlus, Search, Edit2, Check, Loader, CalendarPlus, CalendarClock, MapPin, Plus, Link2, Copy, RefreshCw, LogOut, Trash2 } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useFriendStore } from "../store/useFriendStore";

const RSVP_OPTIONS = [
  { id: "going", label: "Going" },
  { id: "maybe", label: "Maybe" },
  { id: "declined", label: "Can't go" },
];

const formatEventTime = (d) => {
  try {
    return new Date(d).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

const GroupInfoModal = ({ group, onClose, onSelectUser }) => {
  const { authUser, onlineUsers } = useAuthStore();
  const {
    updateGroupInfo, kickGroupMember, toggleGroupAdmin, addGroupMembers,
    createInviteCode, revokeInviteCode, leaveGroup, deleteGroup,
    events, getEvents, createEvent, cancelEvent, rsvpEvent,
  } = useChatStore();
  const { friends, getFriends } = useFriendStore();

  const groupId = group._id || group.id;
  const members = group.members || [];
  const displayName = (group.name || "Group").replace(/^#/, "");
  const myId = authUser?._id?.toString();

  const createdById = group.createdBy?._id || group.createdBy;
  const isCreator = createdById && createdById.toString() === myId;
  const admins = group.admins || (group.createdBy ? [group.createdBy] : []);
  const amIAdmin = isCreator || admins.some((a) => (a?._id || a)?.toString() === myId);

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(displayName);
  const [editedDesc, setEditedDesc] = useState(group.description || "");
  const [isSaving, setIsSaving] = useState(false);
  const [loadingMemberId, setLoadingMemberId] = useState(null);
  const [activeTab, setActiveTab] = useState("members");
  const [showEventForm, setShowEventForm] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evDesc, setEvDesc] = useState("");
  const [evStartsAt, setEvStartsAt] = useState("");
  const [evEndsAt, setEvEndsAt] = useState("");
  const [evLocation, setEvLocation] = useState("");
  const [evSaving, setEvSaving] = useState(false);
  const [evError, setEvError] = useState("");
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [addError, setAddError] = useState("");
  const [inviteCode, setInviteCode] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);

  const memberIdSet = new Set(members.map((m) => (m._id || m)?.toString()));
  const addCandidates = (friends || []).filter((f) => {
    if (!f?._id || memberIdSet.has(f._id.toString())) return false;
    if (addSearch.trim() && !f.username?.toLowerCase().includes(addSearch.trim().toLowerCase())) return false;
    return true;
  });

  const openAddMembers = () => {
    setAddSearch("");
    setSelectedNewMembers([]);
    setAddError("");
    setShowAddMembers(true);
    getFriends?.();
  };

  const toggleNewMember = (friendId) => {
    setSelectedNewMembers((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const handleAddMembers = async () => {
    if (selectedNewMembers.length === 0 || isAddingMembers) return;
    setIsAddingMembers(true);
    setAddError("");
    const res = await addGroupMembers(groupId, selectedNewMembers);
    setIsAddingMembers(false);
    if (res.success) {
      setSelectedNewMembers([]);
      setAddSearch("");
      setShowAddMembers(false);
    } else {
      setAddError(res.error || "Could not add members");
    }
  };

  useEffect(() => {
    if (activeTab === "events" && groupId) {
      getEvents(groupId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, groupId]);

  const handleCreateEvent = async () => {
    if (!evTitle.trim() || !evStartsAt) {
      setEvError("Title and start time are required");
      return;
    }
    setEvSaving(true);
    setEvError("");
    const res = await createEvent({
      roomId: groupId,
      title: evTitle.trim(),
      description: evDesc.trim(),
      startsAt: new Date(evStartsAt).toISOString(),
      endsAt: evEndsAt ? new Date(evEndsAt).toISOString() : undefined,
      location: evLocation.trim(),
    });
    setEvSaving(false);
    if (res.success) {
      setEvTitle(""); setEvDesc(""); setEvStartsAt(""); setEvEndsAt(""); setEvLocation("");
      setShowEventForm(false);
    } else {
      setEvError(res.error || "Could not create event");
    }
  };

  const handleSaveInfo = async () => {
    if (!editedName.trim()) return;
    setIsSaving(true);
    await updateGroupInfo(groupId, {
      name: editedName.trim(),
      description: editedDesc.trim(),
    });
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleKickMember = async (memberId) => {
    if (window.confirm("Are you sure you want to remove this member from the group?")) {
      setLoadingMemberId(memberId);
      await kickGroupMember(groupId, memberId);
      setLoadingMemberId(null);
    }
  };

  const handleToggleAdmin = async (memberId) => {
    setLoadingMemberId(memberId);
    await toggleGroupAdmin(groupId, memberId);
    setLoadingMemberId(null);
  };

  const handleShowInvite = async () => {
    setInviteLoading(true);
    const res = await createInviteCode(groupId);
    setInviteLoading(false);
    if (res.success) {
      setInviteCode(res.inviteCode);
      setInviteCopied(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteCode) return;
    const text = `Join "${displayName}" on Pulse — invite code: ${inviteCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Join ${displayName}`, text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {}
  };

  const handleRevokeInvite = async () => {
    setInviteLoading(true);
    const res = await revokeInviteCode(groupId);
    setInviteLoading(false);
    if (res.success) setInviteCode(null);
  };

  const handleLeave = async () => {
    if (!window.confirm(`Leave "${displayName}"? You will stop receiving its messages.`)) return;
    setLeavingGroup(true);
    const res = await leaveGroup(groupId);
    setLeavingGroup(false);
    if (res.success) onClose();
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm(`Delete "${displayName}" for everyone? This removes the group, its messages and events permanently.`)) return;
    setLeavingGroup(true);
    const res = await deleteGroup(groupId);
    setLeavingGroup(false);
    if (res.success) onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
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
                placeholder="Group Name"
                className="w-full glass-input rounded-xl px-3 py-1.5 text-center font-semibold text-[14px] text-theme-main border border-[var(--glass-border)]"
              />
              <textarea
                value={editedDesc}
                onChange={(e) => setEditedDesc(e.target.value)}
                placeholder="Group Description"
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
                    title="Edit Group Details"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
              </div>

              <p className="text-xs text-theme-muted mt-1 max-w-xs">
                {group.description || "Community Group"}
              </p>
            </>
          )}

          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-accent-primary/15 border border-accent-primary/30 text-accent-primary text-[11px] font-medium">
            <Users size={12} />
            <span>{members.length} {members.length === 1 ? "Member" : "Members"}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pt-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeTab === "members" ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30" : "text-theme-muted border border-transparent"}`}
          >
            Members ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("events")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeTab === "events" ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30" : "text-theme-muted border border-transparent"}`}
          >
            Events ({events.length})
          </button>
        </div>

        {activeTab === "events" ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-0">
            {!showEventForm ? (
              <button
                type="button"
                onClick={() => setShowEventForm(true)}
                className="w-full py-2.5 rounded-2xl border-2 border-dashed border-[var(--glass-border)] text-theme-muted hover:text-accent-primary hover:border-accent-primary/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus size={14} /> Plan an event
              </button>
            ) : (
              <div className="bg-[var(--glass-surface)] rounded-2xl p-3.5 border border-accent-primary/30 space-y-2">
                <input
                  type="text"
                  value={evTitle}
                  onChange={(e) => setEvTitle(e.target.value)}
                  placeholder="Event title..."
                  className="w-full glass-input rounded-xl px-3 py-2 text-[13px] text-theme-main border border-[var(--glass-border)]"
                />
                <textarea
                  value={evDesc}
                  onChange={(e) => setEvDesc(e.target.value)}
                  placeholder="Details (optional)..."
                  rows={2}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-theme-main border border-[var(--glass-border)] resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[10px] text-theme-muted">Starts</span>
                    <input type="datetime-local" value={evStartsAt} onChange={(e) => setEvStartsAt(e.target.value)} className="w-full glass-input rounded-xl px-2 py-1.5 text-[11px] text-theme-main border border-[var(--glass-border)]" />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-theme-muted">Ends</span>
                    <input type="datetime-local" value={evEndsAt} onChange={(e) => setEvEndsAt(e.target.value)} className="w-full glass-input rounded-xl px-2 py-1.5 text-[11px] text-theme-main border border-[var(--glass-border)]" />
                  </label>
                </div>
                <input
                  type="text"
                  value={evLocation}
                  onChange={(e) => setEvLocation(e.target.value)}
                  placeholder="Location (optional)..."
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-theme-main border border-[var(--glass-border)]"
                />
                {evError && <p className="text-[11px] text-red-400">{evError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowEventForm(false); setEvError(""); }} className="flex-1 py-2 rounded-xl text-xs font-medium text-theme-muted hover:bg-[var(--glass-hover)] transition-colors">Cancel</button>
                  <button type="button" onClick={handleCreateEvent} disabled={evSaving} className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-accent-primary hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                    {evSaving ? <Loader size={13} className="animate-spin" /> : <CalendarPlus size={13} />} Create
                  </button>
                </div>
              </div>
            )}

            {events.length === 0 && !showEventForm ? (
              <div className="text-center py-10 text-theme-muted">
                <CalendarClock size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs font-medium text-theme-main">No upcoming events</p>
                <p className="text-[11px] mt-0.5">Plan meetups, deadlines and hangouts for this group.</p>
              </div>
            ) : (
              events.map((ev) => {
                const myRsvp = (ev.rsvps || []).find((r) => (r.userId?._id || r.userId)?.toString() === myId)?.status;
                const counts = { going: 0, maybe: 0, declined: 0 };
                (ev.rsvps || []).forEach((r) => { if (counts[r.status] !== undefined) counts[r.status]++; });
                const canManage = ev.createdBy?._id?.toString() === myId || ev.createdBy?.toString() === myId || amIAdmin;
                return (
                  <div key={ev._id} className="bg-[var(--glass-surface)] rounded-2xl p-3.5 border border-[var(--glass-border)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-theme-main leading-snug">{ev.title}</p>
                        <p className="text-[11px] text-accent-primary font-medium mt-0.5 flex items-center gap-1">
                          <CalendarClock size={11} /> {formatEventTime(ev.startsAt)}
                          {ev.endsAt && <span className="text-theme-muted">→ {formatEventTime(ev.endsAt)}</span>}
                        </p>
                        {ev.location && <p className="text-[11px] text-theme-muted mt-0.5 flex items-center gap-1"><MapPin size={10} /> {ev.location}</p>}
                        {ev.description && <p className="text-[11px] text-theme-muted mt-1 line-clamp-2">{ev.description}</p>}
                      </div>
                      {canManage && (
                        <button type="button" onClick={() => cancelEvent(ev._id)} className="p-1.5 rounded-lg text-theme-muted/60 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0" title="Cancel event">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2.5">
                      {RSVP_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => rsvpEvent(ev._id, opt.id)}
                          className={`flex-1 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${myRsvp === opt.id ? "border-accent-primary bg-accent-primary/15 text-accent-primary" : "border-[var(--glass-border)] text-theme-muted hover:text-theme-main"}`}
                        >
                          {opt.label} · {counts[opt.id] || 0}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-medium text-theme-muted uppercase tracking-wider block">
              Members & Roles ({members.length})
            </span>
            {amIAdmin && !showAddMembers && (
              <button
                type="button"
                onClick={openAddMembers}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-accent-primary bg-accent-primary/10 border border-accent-primary/25 hover:bg-accent-primary/20 transition-all"
              >
                <UserPlus size={12} /> Add
              </button>
            )}
          </div>

          {showAddMembers && amIAdmin && (
            <div className="rounded-2xl border border-accent-primary/30 bg-[var(--glass-surface)] p-3 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-theme-main">
                  Add Members ({selectedNewMembers.length} selected)
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddMembers(false)}
                  className="p-1 rounded-full text-theme-muted hover:text-theme-main transition-colors"
                  title="Close"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-2.5 text-theme-muted/60" />
                <input
                  type="text"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full glass-input rounded-xl pl-9 pr-3 py-1.5 text-xs text-theme-main border border-[var(--glass-border)]"
                />
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1 custom-scrollbar">
                {addCandidates.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-theme-muted">
                    {(friends || []).length === 0
                      ? "No contacts to add. Add contacts first."
                      : "Everyone you know is already in this group."}
                  </p>
                ) : (
                  addCandidates.map((friend) => {
                    const isChecked = selectedNewMembers.includes(friend._id);
                    return (
                      <div
                        key={friend._id}
                        onClick={() => toggleNewMember(friend._id)}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors border ${
                          isChecked
                            ? "bg-accent-primary/10 border-accent-primary/30"
                            : "border-transparent hover:bg-[var(--glass-hover)]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={
                              friend.profilePic ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username || "User")}&background=27272a&color=ffffff`
                            }
                            alt={friend.username}
                            className="w-8 h-8 rounded-full object-cover border border-[var(--glass-border)]"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-theme-main truncate">{friend.username}</p>
                            <p className="text-[10px] text-theme-muted truncate">{friend.status || "Available"}</p>
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                            isChecked
                              ? "bg-accent-primary border-accent-primary text-white"
                              : "border-[var(--glass-border)]"
                          }`}
                        >
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {addError && <p className="text-[11px] text-red-400">{addError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMembers(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-medium text-theme-muted hover:bg-[var(--glass-hover)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddMembers}
                  disabled={selectedNewMembers.length === 0 || isAddingMembers}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-accent-primary hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                >
                  {isAddingMembers ? <Loader size={13} className="animate-spin" /> : <UserPlus size={13} />}
                  Add ({selectedNewMembers.length})
                </button>
              </div>
            </div>
          )}

          {amIAdmin && (
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-theme-main">
                  <Link2 size={12} className="text-accent-primary" /> Invite link
                </span>
                {inviteCode ? (
                  <button
                    type="button"
                    onClick={handleRevokeInvite}
                    disabled={inviteLoading}
                    className="flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw size={11} /> Revoke
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleShowInvite}
                    disabled={inviteLoading}
                    className="flex items-center gap-1 text-[11px] font-semibold text-accent-primary hover:opacity-80 disabled:opacity-50 transition-colors"
                  >
                    {inviteLoading ? <Loader size={11} className="animate-spin" /> : <Link2 size={11} />}
                    Get link
                  </button>
                )}
              </div>
              {inviteCode && (
                <>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 truncate glass-input rounded-xl px-3 py-2 text-xs font-mono text-theme-main border border-[var(--glass-border)]">
                      {inviteCode}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      className="p-2 rounded-xl bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25 transition-colors shrink-0"
                      title="Copy / share invite"
                    >
                      {inviteCopied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-theme-muted">
                    Anyone with this code can join via “Join group”. Revoking instantly disables it.
                  </p>
                </>
              )}
            </div>
          )}

          <div className="space-y-1">
            {members.length === 0 ? (
              <div className="py-6 text-center text-xs text-theme-muted">
                All team members have access to this group.
              </div>
            ) : (
              members.map((member) => {
                const memberId = (member._id || member)?.toString();
                const username = member.username || "Member";
                const isOnline = (onlineUsers || []).includes(memberId);
                const thisCreatorId = (group.createdBy?._id || group.createdBy)?.toString();
                const isThisMemberCreator = thisCreatorId && thisCreatorId === memberId;
                const isThisMemberAdmin = isThisMemberCreator || admins.some((a) => (a?._id || a)?.toString() === memberId);
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
                              title={isThisMemberAdmin ? "Revoke Admin Role" : "Make Group Admin"}
                            >
                              <ShieldCheck size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleKickMember(memberId)}
                            disabled={isLoading}
                            className="p-1.5 rounded-lg text-theme-muted hover:text-red-400 hover:bg-red-500/15 transition-colors"
                            title="Remove from Group"
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
        )}

        {/* Footer */}
        <div className="p-3.5 border-t border-[var(--glass-border)] bg-[var(--glass-hover)] flex items-center justify-between gap-2">
          {isCreator ? (
            <button
              type="button"
              onClick={handleDeleteGroup}
              disabled={leavingGroup}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              {leavingGroup ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Delete group
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLeave}
              disabled={leavingGroup}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              {leavingGroup ? <Loader size={13} className="animate-spin" /> : <LogOut size={13} />}
              Leave group
            </button>
          )}
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
