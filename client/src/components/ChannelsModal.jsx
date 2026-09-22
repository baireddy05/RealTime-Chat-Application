import { useEffect, useState } from "react";
import { X, Megaphone, Plus, Loader, Check, Search, Users } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useBackHandler } from "../lib/backNavigation";

// Public broadcast channels: discover, follow, and create.
// Channels are admin-post-only; followers read.
const ChannelsModal = ({ onClose, onOpenChannel }) => {
  const {
    publicChannels,
    isChannelsLoading,
    getPublicChannels,
    createChannel,
    followChannel,
    unfollowChannel,
  } = useChatStore();

  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useBackHandler(true, onClose, "channels");

  useEffect(() => {
    getPublicChannels("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => getPublicChannels(query.trim()), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleCreate = async () => {
    if (!name.trim() || isCreating) return;
    setIsCreating(true);
    setError("");
    const res = await createChannel({ name: name.trim(), description: description.trim() });
    setIsCreating(false);
    if (res.success) {
      setName("");
      setDescription("");
      getPublicChannels(query.trim());
      if (res.room) onOpenChannel?.(res.room);
    } else {
      setError(res.error || "Could not create channel");
    }
  };

  const handleToggleFollow = async (channel) => {
    setBusyId(channel._id);
    if (channel.followed) {
      await unfollowChannel(channel._id);
    } else {
      const res = await followChannel(channel._id);
      if (res.success && res.room) onOpenChannel?.(res.room);
    }
    setBusyId(null);
    getPublicChannels(query.trim());
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex items-center justify-center p-4 max-md:p-0 animate-fadeIn select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl w-full max-w-md overflow-hidden shadow-glass animate-scaleIn text-theme-main flex flex-col max-h-[85vh] max-md:max-w-none max-md:h-full max-md:max-h-full max-md:rounded-none max-md:border-0"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-hover)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-accent-primary/15 text-accent-primary flex items-center justify-center">
              <Megaphone size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-theme-main">Channels</h3>
              <p className="text-[11px] text-theme-muted">Follow public broadcasts</p>
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
          {/* Create */}
          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3 space-y-2">
            <p className="text-[11px] font-bold text-theme-main">Start your own channel</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Channel name…"
              maxLength={60}
              className="w-full glass-input rounded-xl px-3 py-2 text-[13px] text-theme-main border border-[var(--glass-border)]"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is it about? (optional)"
              maxLength={140}
              className="w-full glass-input rounded-xl px-3 py-2 text-xs text-theme-main border border-[var(--glass-border)]"
            />
            {error && <p className="text-[11px] text-red-400">{error}</p>}
            <button
              type="button"
              onClick={handleCreate}
              disabled={!name.trim() || isCreating}
              className="w-full py-2 rounded-xl bg-accent-primary text-white text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
            >
              {isCreating ? <Loader size={13} className="animate-spin" /> : <Plus size={13} />}
              Create channel
            </button>
          </div>

          {/* Directory search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-theme-muted/60" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search channels…"
              className="w-full glass-input rounded-xl pl-9 pr-3 py-2 text-xs text-theme-main border border-[var(--glass-border)]"
            />
          </div>

          {/* Directory */}
          {isChannelsLoading && (publicChannels || []).length === 0 ? (
            <div className="flex items-center justify-center py-10 gap-2 text-theme-muted">
              <Loader size={16} className="animate-spin text-accent-primary" />
              <span className="text-xs">Loading channels…</span>
            </div>
          ) : (publicChannels || []).length === 0 ? (
            <p className="text-xs text-theme-muted text-center py-8">
              No channels yet — start the first one above.
            </p>
          ) : (
            (publicChannels || []).map((c) => (
              <div
                key={c._id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-2xl bg-accent-primary/15 text-accent-primary flex items-center justify-center shrink-0">
                    <Megaphone size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-theme-main truncate">
                      {(c.name || "Channel").replace(/^#/, "")}
                    </p>
                    <p className="text-[10px] text-theme-muted truncate flex items-center gap-1">
                      <Users size={10} />
                      {(c.followersCount ?? 0)} followers
                      {c.description ? ` • ${c.description}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFollow(c)}
                  disabled={busyId === c._id}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all disabled:opacity-50 flex items-center gap-1 ${
                    c.followed
                      ? "bg-[var(--glass-hover)] text-theme-muted border border-[var(--glass-border)]"
                      : "bg-accent-primary text-white"
                  }`}
                >
                  {busyId === c._id ? (
                    <Loader size={12} className="animate-spin" />
                  ) : c.followed ? (
                    <>
                      <Check size={12} strokeWidth={3} /> Following
                    </>
                  ) : (
                    <>
                      <Plus size={12} strokeWidth={3} /> Follow
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ChannelsModal;
