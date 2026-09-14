import { useState } from "react";
import { X, Users, Loader, Check } from "lucide-react";
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
      setError("Please enter a group name");
      return;
    }

    setIsLoading(true);
    setError("");

    // Clean name: remove any leading # so groups are WhatsApp style
    const cleanName = name.trim().replace(/^#+/, "");

    const res = await createRoom({
      name: cleanName,
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
      setError(res.error || "Failed to create group");
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 dark:bg-black/75 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white/95 dark:bg-[#121117]/90 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleIn text-zinc-900 dark:text-white flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center font-bold shadow-md">
              <Users size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">New Group</h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Add group name and select participants</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs font-medium animate-fadeIn">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
              Group Subject *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-zinc-400">
                <Users size={16} />
              </span>
              <input
                type="text"
                placeholder="e.g. Design Team, Family, Weekend Trip"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="w-full rounded-2xl pl-10 pr-3 py-2.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 border border-black/10 dark:border-white/10 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-all bg-black/[0.03] dark:bg-white/5"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
              Group Description (Optional)
            </label>
            <textarea
              placeholder="What is this group about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-2xl px-3 py-2.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 border border-black/10 dark:border-white/10 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-all resize-none bg-black/[0.03] dark:bg-white/5"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Select Participants ({selectedMembers.length})
              </label>
              <span className="text-[11px] text-zinc-500">
                {friends.length} contact{friends.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] p-2 border border-black/10 dark:border-white/10 custom-scrollbar">
              {friends.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500">
                  No contacts found to add. Add contacts first.
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
                          ? "bg-black/5 border border-black/15 text-zinc-900 dark:bg-white/15 dark:border-white/20 dark:text-white"
                          : "hover:bg-black/5 dark:hover:bg-white/5 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={
                            friend.profilePic ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username || "User")}&background=27272a&color=ffffff`
                          }
                          alt={friend.username}
                          className="w-8 h-8 rounded-full object-cover border border-black/10 dark:border-white/10"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate text-zinc-900 dark:text-white">
                            {friend.username}
                          </p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                            {friend.status || "Available"}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                          isChecked
                            ? "bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:border-white dark:text-black font-bold shadow-sm"
                            : "border-black/20 bg-black/5 dark:border-white/20 dark:bg-white/5"
                        }`}
                      >
                        {isChecked && <Check size={12} strokeWidth={3} />}
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
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 dark:text-black dark:bg-white dark:hover:bg-zinc-200 shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {isLoading ? <Loader size={14} className="animate-spin text-white dark:text-black" /> : <Users size={14} />}
              <span>Create Group</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;
