import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { parseEmojiToHtml } from "../lib/emoji";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

// Helper to recursively parse text nodes for Emoji and Search Highlights
const processText = (textStr, searchQuery) => {
  if (typeof textStr !== "string") return textStr;
  
  // Format URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urlParts = textStr.split(urlRegex);

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
};

export const FormattedMessageText = ({ text, isMine, searchQuery }) => {
  if (!text) return null;

  return (
    <div className={`space-y-1 select-text break-words [overflow-wrap:anywhere] [word-break:break-word] min-w-0 max-w-full prose prose-sm ${isMine ? 'prose-invert' : ''} dark:prose-invert prose-p:my-1 prose-a:text-accent-primary prose-a:no-underline hover:prose-a:underline prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({node, className, children, ...props}) {
            const match = /language-(\w+)/.exec(className || '');
            // In react-markdown v10, block code is wrapped in <pre> or has newlines/language class
            const isMultiLine = String(children).includes('\n');
            const hasLang = Boolean(match);
            if (hasLang || isMultiLine) {
              return (
                <CodeSnippetBlock
                  code={String(children).replace(/\n$/, '')}
                  language={match ? match[1] : 'code'}
                />
              );
            }
            return (
              <code
                className="px-1.5 py-0.5 mx-0.5 rounded-md font-mono text-[12px] bg-current/10 border border-current/15 font-semibold inline-block align-baseline"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({children}) {
            return <>{children}</>;
          },
          p({children}) {
            return (
              <div className="whitespace-pre-wrap leading-relaxed my-1">
                {Array.isArray(children)
                  ? children.map((child, i) => (
                      <span key={i}>
                        {typeof child === 'string' ? processText(child, searchQuery) : child}
                      </span>
                    ))
                  : typeof children === 'string'
                  ? processText(children, searchQuery)
                  : children}
              </div>
            );
          },
          li({children}) {
            return (
              <li className="leading-relaxed m-0">
                {Array.isArray(children)
                  ? children.map((child, i) => (
                      <span key={i}>
                        {typeof child === 'string' ? processText(child, searchQuery) : child}
                      </span>
                    ))
                  : typeof children === 'string'
                  ? processText(children, searchQuery)
                  : children}
              </li>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

export default FormattedMessageText;
