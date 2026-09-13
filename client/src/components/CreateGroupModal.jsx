import { useState } from "react";
import { X, Users, Loader, Check, Hash } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useFriendStore } from "../store/useFriendStore";

const CreateGroupModal = ({ onClose }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { friends } = useFriendStore();
  const { createRoom, setSelectedChat } = useChatStore();

  const toggleMember = (userId) => {
    if (selectedMembers.includes(userId)) {
      setSelectedMembers(selectedMembers.filter((id) => id !== userId));
    } else {
      setSelectedMembers([...selectedMembers, userId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a channel name");
      return;
    }

    setIsLoading(true);
    setError("");

    const res = await createRoom({
      name: name.trim(),
      description: description.trim(),
      memberIds: selectedMembers,
    });

    setIsLoading(false);

    if (res.success && res.room) {
      setSelectedChat({
        id: res.room._id,
        type: "room",
        name: res.room.name,
        description: res.room.description,
        members: res.room.members,
      });
      onClose();
    } else {
      setError(res.error || "Failed to create channel");
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl w-full max-w-md overflow-hidden shadow-glass animate-scaleIn text-theme-main"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-hover)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent-primary flex items-center justify-center text-white shadow-md shadow-accent-primary/25">
              <Users size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-theme-main">New Channel</h3>
              <p className="text-[11px] text-theme-muted">Create a collaborative space</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-500 text-xs font-medium animate-fadeIn">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-theme-muted mb-1.5 uppercase tracking-wider">
              Channel Name *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-accent-primary font-bold">
                <Hash size={15} />
              </span>
              <input
                type="text"
                placeholder="e.g. design-squad"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="w-full glass-input rounded-2xl pl-9 pr-3 py-2 text-xs text-theme-main placeholder-theme-muted/40 border border-[var(--glass-border)] focus:outline-none focus:border-accent-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-theme-muted mb-1.5 uppercase tracking-wider">
              Topic / Purpose
            </label>
            <textarea
              placeholder="What is this channel for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full glass-input rounded-2xl px-3 py-2 text-xs text-theme-main placeholder-theme-muted/40 border border-[var(--glass-border)] focus:outline-none focus:border-accent-primary transition-all resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium text-theme-muted uppercase tracking-wider">
                Select Members ({selectedMembers.length})
              </label>
              <span className="text-[11px] text-theme-muted/60">
                {friends.length} friend{friends.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1 rounded-2xl bg-[var(--glass-surface)] p-2 border border-[var(--glass-border)]">
              {friends.length === 0 ? (
                <div className="py-6 text-center text-xs text-theme-muted">
                  No friends found to invite.
                </div>
              ) : (
                friends.map((friend) => {
                  const isChecked = selectedMembers.includes(friend._id);
                  return (
                    <div
                      key={friend._id}
                      onClick={() => toggleMember(friend._id)}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-accent-primary/20 border border-accent-primary/40 text-theme-main"
                          : "hover:bg-[var(--glass-hover)] text-theme-main"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={
                            friend.profilePic ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username || "User")}&background=2563eb&color=ffffff`
                          }
                          alt={friend.username}
                          className="w-7 h-7 rounded-full object-cover border border-[var(--glass-border)]"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate text-theme-main">
                            {friend.username}
                          </p>
                          <p className="text-[10px] text-theme-muted truncate">
                            {friend.status || "Active"}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                          isChecked
                            ? "bg-accent-primary border-accent-primary text-white shadow-sm"
                            : "border-[var(--glass-border)] bg-[var(--glass-hover)]"
                        }`}
                      >
                        {isChecked && <Check size={10} strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-medium text-white bg-accent-primary hover:bg-accent-primary/80 shadow-md shadow-accent-primary/25 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {isLoading ? <Loader size={13} className="animate-spin text-white" /> : <Users size={13} />}
              <span>Create Channel</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;
