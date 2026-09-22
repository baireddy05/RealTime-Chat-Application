import { useState, useRef } from "react";
import { X, Code2, Send, Terminal, FileCode } from "lucide-react";
import { soundManager } from "../lib/sound";

const LANGUAGES = [
  { id: "javascript", label: "JavaScript (.js)" },
  { id: "typescript", label: "TypeScript (.ts)" },
  { id: "python", label: "Python (.py)" },
  { id: "html", label: "HTML (.html)" },
  { id: "css", label: "CSS (.css)" },
  { id: "sql", label: "SQL (.sql)" },
  { id: "json", label: "JSON (.json)" },
  { id: "rust", label: "Rust (.rs)" },
  { id: "go", label: "Go (.go)" },
  { id: "cpp", label: "C++ (.cpp)" },
  { id: "java", label: "Java (.java)" },
  { id: "bash", label: "Bash / Shell (.sh)" },
  { id: "markdown", label: "Markdown (.md)" },
];

const CodeSnippetModal = ({ isOpen, onClose, onSendSnippet }) => {
  const [language, setLanguage] = useState("javascript");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const lineNumbersRef = useRef(null);

  if (!isOpen) return null;

  const lineCount = code ? code.split("\n").length : 1;

  const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newCode = code.substring(0, start) + "  " + code.substring(end);
      setCode(newCode);
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleSend = () => {
    if (!code.trim()) return;
    soundManager.playSendSound();
    
    // Format snippet as markdown code block
    let formatted = "";
    if (title.trim()) {
      formatted += `### 📄 \`${title.trim()}\`\n`;
    }
    formatted += "```" + language + "\n" + code + "\n```";

    onSendSnippet(formatted);
    setCode("");
    setTitle("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900/95 border border-[var(--glass-border)] rounded-3xl w-full max-w-2xl max-h-[94dvh] shadow-2xl flex flex-col overflow-hidden animate-scaleIn">
        {/* Header Bar */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[var(--glass-border)] flex items-center justify-between bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent-primary/20 text-accent-primary flex items-center justify-center">
              <Code2 size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Share Code Snippet</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent-primary/20 text-accent-primary uppercase tracking-wider">
                  Syntax Highlighted
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">Paste code with syntax highlighting and line numbers</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Options Bar: Language & Optional Filename */}
        <div className="p-3 sm:p-3.5 border-b border-[var(--glass-border)] bg-slate-800/20 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 shrink-0">
          {/* Language Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 mb-1 flex items-center gap-1">
              <Terminal size={12} className="text-accent-primary" />
              <span>Language:</span>
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-accent-primary transition-colors cursor-pointer"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id} className="bg-slate-900 text-zinc-200">
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Optional Filename / Title */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 mb-1 flex items-center gap-1">
              <FileCode size={12} className="text-accent-secondary" />
              <span>Title / Filename (optional):</span>
            </label>
            <input
              type="text"
              placeholder="e.g. authMiddleware.js or Query.sql"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-accent-secondary transition-colors"
            />
          </div>
        </div>

        {/* Code Input Area with synchronized line numbers */}
        <div className="relative flex bg-[#0d1117] flex-1 min-h-[180px] max-h-[380px] overflow-hidden font-mono text-[12px] leading-relaxed select-text border-b border-[var(--glass-border)]">
          {/* Line Numbers column (Synced scrolling) */}
          <div
            ref={lineNumbersRef}
            className="w-12 py-3 bg-slate-950/80 text-zinc-600 text-right pr-3 select-none flex-shrink-0 font-mono text-[12px] leading-relaxed border-r border-white/5 overflow-hidden"
          >
            {Array.from({ length: Math.min(lineCount, 500) }).map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={(e) => {
              if (lineNumbersRef.current) {
                lineNumbersRef.current.scrollTop = e.target.scrollTop;
              }
            }}
            placeholder="// Paste or write your code here...&#10;function helloWorld() {&#10;  console.log('Hello Pulse!');&#10;}"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            className="flex-1 py-3 px-3.5 bg-transparent text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none font-mono text-[12px] leading-relaxed overflow-y-auto custom-scrollbar"
          />
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-800/40 flex items-center justify-between">
          <div className="text-[11px] text-zinc-400 flex items-center gap-3">
            <span>{lineCount} {lineCount === 1 ? "line" : "lines"}</span>
            <span>•</span>
            <span>{code.length} characters</span>
            <span>•</span>
            <span className="text-accent-primary uppercase font-bold">{language}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!code.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-semibold shadow-glow active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all"
            >
              <Send size={13} />
              <span>Send Snippet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeSnippetModal;
