import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { parseEmojiToHtml } from "../lib/emoji";

export const CodeSnippetBlock = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const detectedLang = language?.trim() || "code";

  return (
    <div className="my-2 rounded-2xl overflow-hidden border border-[var(--glass-border)] bg-slate-950/80 shadow-glass text-left w-full font-mono text-[12px]">
      {/* Code Header Bar */}
      <div className="px-3.5 py-1.5 bg-[var(--glass-surface)]/70 border-b border-[var(--glass-border)] flex items-center justify-between">
        <div className="flex items-center gap-2 text-theme-muted">
          <Terminal size={12} className="text-accent-primary" />
          <span className="text-[11px] font-semibold tracking-wider uppercase text-accent-primary/90">
            {detectedLang}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-[var(--glass-hover)] hover:bg-white/10 text-theme-muted hover:text-white transition-all active:scale-95"
          title="Copy Code"
        >
          {copied ? (
            <>
              <Check size={11} className="text-white" />
              <span className="text-white font-semibold">Copied</span>
            </>
          ) : (
            <>
              <Copy size={11} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <pre className="p-3.5 overflow-x-auto text-zinc-200 font-mono text-[12px] leading-relaxed select-text no-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const FormattedMessageText = ({ text, isMine, searchQuery }) => {
  if (!text) return null;

  // Split text by markdown code blocks: ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.substring(lastIndex, match.index),
      });
    }
    parts.push({
      type: "code",
      language: match[1],
      code: match[2].trimEnd(),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.substring(lastIndex),
    });
  }

  // Render normal text with links, inline code, search highlight, and Twemoji
  const renderInlineText = (str) => {
    // Split by inline code `...`
    const inlineParts = str.split(/(`[^`]+`)/g);

    return inlineParts.map((sub, i) => {
      if (sub.startsWith("`") && sub.endsWith("`") && sub.length > 2) {
        const inlineCode = sub.slice(1, -1);
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 mx-0.5 rounded-md font-mono text-[11px] bg-current/10 border border-current/15 font-semibold"
          >
            {inlineCode}
          </code>
        );
      }

      // Format URLs in sub
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urlParts = sub.split(urlRegex);

      return urlParts.map((urlSub, j) => {
        if (urlSub.match(urlRegex)) {
          return (
            <a
              key={j}
              href={urlSub}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 break-all transition-opacity font-semibold opacity-95 hover:opacity-75"
              onClick={(e) => e.stopPropagation()}
            >
              {urlSub}
            </a>
          );
        }

        // Search match highlight
        if (searchQuery && searchQuery.trim()) {
          const trimmed = searchQuery.trim();
          const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const searchRegex = new RegExp(`(${escaped})`, "gi");
          const matchParts = urlSub.split(searchRegex);

          return matchParts.map((m, k) =>
            m.toLowerCase() === trimmed.toLowerCase() ? (
              <mark
                key={k}
                className="bg-yellow-400/35 text-current font-bold px-1 rounded border border-yellow-500/30"
                dangerouslySetInnerHTML={{ __html: parseEmojiToHtml(m) }}
              />
            ) : (
              <span
                key={k}
                dangerouslySetInnerHTML={{ __html: parseEmojiToHtml(m) }}
              />
            )
          );
        }

        return (
          <span
            key={j}
            dangerouslySetInnerHTML={{ __html: parseEmojiToHtml(urlSub) }}
          />
        );
      });
    });
  };

  return (
    <div className="space-y-1 select-text break-words [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap min-w-0 max-w-full">
      {parts.map((part, idx) => {
        if (part.type === "code") {
          return (
            <CodeSnippetBlock
              key={idx}
              code={part.code}
              language={part.language}
            />
          );
        }
        return (
          <span key={idx} className="break-words [overflow-wrap:anywhere] [word-break:break-word]">
            {renderInlineText(part.content)}
          </span>
        );
      })}
    </div>
  );
};

export default FormattedMessageText;
