import { useState, useEffect } from "react";
import { 
  X, 
  Plus, 
  Trash2, 
  Copy, 
  Send, 
  Check, 
  StickyNote, 
  Edit2, 
} from "lucide-react";
import { soundManager } from "../lib/sound";

const STORAGE_KEY = "pulse_quick_notes";

const DEFAULT_NOTES = [
  {
    id: "default-1",
    title: "Meeting Notes",
    content: "• Review product launch checklist\n• Discuss WebRTC audio calibration\n• Prepare deployment docs",
    updatedAt: new Date().toISOString(),
  },
];

const QuickNotesDrawer = ({ isOpen, onClose, onSendToChat }) => {
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_NOTES;
  });

  const [activeNoteId, setActiveNoteId] = useState(() => notes[0]?.id || "default-1");
  const [copied, setCopied] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {}
  }, [notes]);

  const handleCreateNote = () => {
    const newNote = {
      id: "note-" + Date.now(),
      title: `Note ${notes.length + 1}`,
      content: "",
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
  };

  const handleDeleteNote = (id) => {
    if (notes.length <= 1) {
      // Clear instead of deleting last one
      setNotes([{ id: "default-1", title: "My Notes", content: "", updatedAt: new Date().toISOString() }]);
      setActiveNoteId("default-1");
      return;
    }
    const filtered = notes.filter((n) => n.id !== id);
    setNotes(filtered);
    if (activeNoteId === id) {
      setActiveNoteId(filtered[0]?.id || "");
    }
  };

  const handleUpdateContent = (content) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNoteId
          ? { ...n, content, updatedAt: new Date().toISOString() }
          : n
      )
    );
  };

  const handleStartRename = () => {
    if (!activeNote) return;
    setRenameTitle(activeNote.title);
    setIsRenaming(true);
  };

  const handleSaveRename = () => {
    if (!renameTitle.trim() || !activeNote) {
      setIsRenaming(false);
      return;
    }
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNoteId ? { ...n, title: renameTitle.trim() } : n
      )
    );
    setIsRenaming(false);
  };

  const handleCopyNote = () => {
    if (!activeNote?.content) return;
    navigator.clipboard.writeText(activeNote.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    if (!activeNote?.content?.trim() || !onSendToChat) return;
    soundManager.playSendSound();
    onSendToChat(activeNote.content);
  };

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-[var(--modal-backdrop)] backdrop-blur-sm animate-fadeIn cursor-pointer"
    >
      <div 
        className="w-full max-w-md h-full bg-[var(--glass-heavy-opaque)] border-l border-[var(--glass-border)] text-theme-main shadow-2xl flex flex-col overflow-hidden animate-slideInRight cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-4 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--glass-hover)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
              <StickyNote size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-theme-main flex items-center gap-1.5">
                <span>Scratchpad & Notes</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-500 uppercase tracking-wider">
                  Local
                </span>
              </h3>
              <p className="text-[11px] text-theme-muted">Jot thoughts or draft messages while chatting</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCreateNote}
              className="p-2 rounded-xl text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer"
              title="New Note"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-all cursor-pointer"
              title="Close Drawer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Note Tabs Carousel */}
        <div className="px-3 py-2 border-b border-[var(--glass-border)] bg-[var(--glass-hover)] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => {
                setActiveNoteId(note.id);
                setIsRenaming(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                note.id === activeNoteId
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-semibold shadow-sm"
                  : "text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] border border-transparent"
              }`}
            >
              <span className="max-w-[110px] truncate">{note.title}</span>
            </button>
          ))}
        </div>

        {/* Active Note Content */}
        {activeNote && (
          <div className="flex-1 flex flex-col min-h-0 bg-transparent">
            {/* Note Title Toolbar */}
            <div className="px-4 py-2.5 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--glass-hover)]">
              {isRenaming ? (
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <input
                    type="text"
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveRename()}
                    autoFocus
                    className="bg-[var(--glass-input)] px-2 py-1 rounded-lg text-xs text-theme-main border border-amber-500/50 focus:outline-none flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleSaveRename}
                    className="p-1 rounded-lg bg-amber-500 text-black text-xs font-bold cursor-pointer"
                  >
                    <Check size={13} />
                  </button>
                </div>
              ) : (
                <div 
                  onClick={handleStartRename}
                  className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-theme-main hover:text-amber-500 group"
                  title="Click to rename note"
                >
                  <span className="truncate max-w-[200px]">{activeNote.title}</span>
                  <Edit2 size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-amber-500" />
                </div>
              )}

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopyNote}
                  className="p-1.5 rounded-lg text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-all text-xs cursor-pointer"
                  title="Copy Note"
                >
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteNote(activeNote.id)}
                  className="p-1.5 rounded-lg text-theme-muted hover:text-red-500 hover:bg-red-500/10 transition-all text-xs cursor-pointer"
                  title="Delete Note"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Note Textarea */}
            <textarea
              value={activeNote.content}
              onChange={(e) => handleUpdateContent(e.target.value)}
              placeholder="Write your note, checklist, or paste links here...&#10;&#10;Everything is automatically saved to your browser."
              className="flex-1 w-full p-4 bg-transparent text-theme-main placeholder:text-theme-muted resize-none focus:outline-none text-xs leading-relaxed font-sans"
            />
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-3.5 border-t border-[var(--glass-border)] bg-[var(--glass-hover)] flex items-center justify-between">
          <div className="text-[11px] text-theme-muted">
            {activeNote?.content ? `${activeNote.content.length} chars` : "Empty note"}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={!activeNote?.content?.trim() || !onSendToChat}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all"
              title="Insert note into active chat"
            >
              <Send size={13} />
              <span>Send to Chat</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickNotesDrawer;
