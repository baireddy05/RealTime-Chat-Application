import { useEffect, useState } from "react";
import { X, Search, Loader, FileText, Image as ImageIcon, Mic, ExternalLink } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useBackHandler } from "../lib/backNavigation";
import { isEncryptedMessage } from "../lib/crypto";

const GlobalSearchModal = ({ onClose, initialChat }) => {
  const { globalSearchResults, isGlobalSearchLoading, searchMessages, clearGlobalSearch, jumpToMessage, rooms } = useChatStore();
  const [query, setQuery] = useState("");
  const [mediaOnly, setMediaOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useBackHandler(true, onClose, "global-search");

  useEffect(() => {
    return () => clearGlobalSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const hasFilter = query.trim() || mediaOnly || from || to;
      if (!hasFilter) {
        clearGlobalSearch();
        return;
      }
      searchMessages({
        query: query.trim() || undefined,
        hasMedia: mediaOnly || undefined,
        from: from || undefined,
        to: to || undefined,
        ...(initialChat?.type === "room" ? { chatId: initialChat.id, chatType: "room" } : {}),
      });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mediaOnly, from, to]);

  const snippet = (m) => {
    const text = m.decryptedText || (!isEncryptedMessage(m.text) ? m.text : "") || "";
    if (text) {
      const idx = query.trim() ? text.toLowerCase().indexOf(query.trim().toLowerCase()) : 0;
      const start = Math.max(0, idx - 30);
      return (start > 0 ? "…" : "") + text.slice(start, start + 110) + (text.length > start + 110 ? "…" : "");
    }
    if (m.image) return "📷 Photo";
    if (m.audio) return "🎤 Voice note";
    if (m.file) return `📎 ${m.file.name || "File"}`;
    return "Message";
  };

  const chatName = (m) => {
    if (m.roomId) {
      const rid = (m.roomId?._id || m.roomId)?.toString();
      const room = (rooms || []).find((r) => (r._id || r.id)?.toString() === rid);
      return room?.name || m.roomId?.name || "Group";
    }
    return m.senderId?.username || "Direct message";
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-[var(--modal-backdrop)] backdrop-blur-md flex items-start justify-center p-4 pt-[10vh] animate-fadeIn">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl w-full max-w-lg overflow-hidden shadow-glass animate-scaleIn text-theme-main flex flex-col max-h-[75vh]"
      >
        <div className="p-4 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-2xl px-3 py-2">
              <Search size={15} className="text-theme-muted shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search all messages..."
                className="bg-transparent flex-1 min-w-0 text-sm text-theme-main placeholder:text-theme-muted/50 focus:outline-none"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="text-theme-muted hover:text-theme-main">
                  <X size={14} />
                </button>
              )}
            </div>
            <button onClick={onClose} className="p-2 rounded-full text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <button
              type="button"
              onClick={() => setMediaOnly((v) => !v)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${mediaOnly ? "border-accent-primary bg-accent-primary/15 text-accent-primary" : "border-[var(--glass-border)] text-theme-muted"}`}
            >
              Media only
            </button>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="glass-input rounded-full px-2.5 py-1 text-[11px] text-theme-main border border-[var(--glass-border)]" title="From date" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="glass-input rounded-full px-2.5 py-1 text-[11px] text-theme-main border border-[var(--glass-border)]" title="To date" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[200px]">
          {isGlobalSearchLoading ? (
            <div className="flex items-center justify-center py-14 gap-2 text-theme-muted">
              <Loader size={18} className="animate-spin text-accent-primary" />
              <span className="text-xs">Searching...</span>
            </div>
          ) : globalSearchResults.length === 0 ? (
            <div className="text-center py-14 text-theme-muted px-6">
              <Search size={26} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium text-theme-main">Search everywhere</p>
              <p className="text-xs mt-1">Find text across all your chats, filter by media or date.</p>
            </div>
          ) : (
            globalSearchResults.map((m) => (
              <button
                key={m._id}
                type="button"
                onClick={() => { onClose(); jumpToMessage(m); }}
                className="w-full text-left p-3 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] hover:border-accent-primary/40 transition-all group"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-accent-primary truncate">{chatName(m)}</span>
                  <span className="text-[10px] text-theme-muted shrink-0">
                    {new Date(m.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-xs text-theme-main flex items-center gap-1.5">
                  {m.image ? <ImageIcon size={12} /> : m.audio ? <Mic size={12} /> : m.file ? <FileText size={12} /> : null}
                  <span className="truncate">{snippet(m)}</span>
                </p>
                <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-theme-muted group-hover:text-accent-primary">
                  <ExternalLink size={10} /> Jump to message
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchModal;
