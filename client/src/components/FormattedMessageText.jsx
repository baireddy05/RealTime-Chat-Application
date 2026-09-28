import { memo, useMemo, useState } from "react";
import { Check, Copy, Terminal, TextWrap } from "lucide-react";
import { parseEmojiToHtml } from "../lib/emoji";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const CodeSnippetBlock = memo(({ code, language }) => {
  const [copied, setCopied] = useState(false);
  const [isWrapped, setIsWrapped] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const detectedLang = language?.trim() || "code";

  return (
    <div 
      data-code-block="true" 
      data-no-swipe="true"
      className="my-2 rounded-2xl overflow-hidden border border-[var(--glass-border)] bg-slate-950/90 shadow-glass text-left w-full font-mono text-[12px] select-text"
      style={{ touchAction: "pan-x pan-y" }}
    >
      {/* Code Header Bar */}
      <div className="px-3.5 py-1.5 bg-[var(--glass-surface)]/70 border-b border-[var(--glass-border)] flex items-center justify-between select-none">
        <div className="flex items-center gap-2 text-theme-muted min-w-0">
          <Terminal size={12} className="text-accent-primary shrink-0" />
          <span className="text-[11px] font-semibold tracking-wider uppercase text-accent-primary/90 truncate">
            {detectedLang}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsWrapped((prev) => !prev)}
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg transition-all active:scale-95 ${
              isWrapped 
                ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30" 
                : "bg-[var(--glass-hover)] hover:bg-white/10 text-theme-muted hover:text-white"
            }`}
            title={isWrapped ? "Scroll mode: Keep original formatting" : "Wrap mode: Wrap lines to screen"}
          >
            <TextWrap size={11} />
            <span>{isWrapped ? "Wrapped" : "Wrap"}</span>
          </button>
          <button
            type="button"
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
      </div>

      {/* Code Content */}
      <pre 
        data-code-block="true"
        className={`p-3.5 code-scroll-chain text-zinc-200 font-mono text-[12px] leading-relaxed select-text ${
          isWrapped 
            ? "whitespace-pre-wrap break-words overflow-x-hidden" 
            : "overflow-x-auto whitespace-pre"
        }`}
        style={{
          touchAction: "pan-x pan-y",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorX: "contain",
          overscrollBehaviorY: "auto",
        }}
      >
        <code className="select-text">{code}</code>
      </pre>
    </div>
  );
});

export const SpoilerSpan = memo(({ children }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setRevealed((prev) => !prev);
      }}
      title={revealed ? "Click to conceal spoiler" : "Spoiler: Click to reveal"}
      className={`inline-block px-1.5 py-0.5 rounded-lg cursor-pointer transition-all duration-200 select-none mx-0.5 font-medium ${
        revealed
          ? "bg-current/15 text-inherit shadow-sm"
          : "bg-slate-700/80 dark:bg-slate-800/90 text-transparent blur-[5px] hover:blur-[3px] border border-white/10"
      }`}
    >
      {children}
    </span>
  );
});

// Helper to recursively parse text nodes for Spoiler, Emoji, URLs, Mentions
// and Search Highlights. highlightNames lists group member usernames whose
// @mentions render as accent pills (E2EE-safe: pure render-time matching).
const processText = (textStr, searchQuery, highlightNames = []) => {
  if (typeof textStr !== "string") return textStr;

  const mentionSet = new Set((highlightNames || []).filter(Boolean).map((n) => String(n).toLowerCase()));
  const renderWithMentions = (raw, keyPrefix) => {
    if (mentionSet.size === 0) {
      return (
        <span key={keyPrefix} dangerouslySetInnerHTML={{ __html: parseEmojiToHtml(raw) }} />
      );
    }
    const parts = String(raw).split(/(@[\w.-]+)/g);
    return parts.map((chunk, k) => {
      const name = chunk.startsWith("@") ? chunk.slice(1).toLowerCase() : "";
      if (name && mentionSet.has(name)) {
        return (
          <span
            key={`${keyPrefix}-m-${k}`}
            className="font-bold text-accent-primary bg-accent-primary/15 border border-accent-primary/30 px-1 rounded-md whitespace-nowrap"
          >
            {chunk}
          </span>
        );
      }
      return (
        <span
          key={`${keyPrefix}-t-${k}`}
          dangerouslySetInnerHTML={{ __html: parseEmojiToHtml(chunk) }}
        />
      );
    });
  };
  
  // Format Spoilers: ||spoiler||
  const spoilerRegex = /(\|\|[\s\S]+?\|\|)/g;
  const spoilerParts = textStr.split(spoilerRegex);

  return spoilerParts.map((part, sIdx) => {
    if (part.startsWith("||") && part.endsWith("||") && part.length >= 4) {
      const spoilerInner = part.slice(2, -2);
      return (
        <SpoilerSpan key={`spoiler-${sIdx}`}>
          {processText(spoilerInner, searchQuery, highlightNames)}
        </SpoilerSpan>
      );
    }

    // Format URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urlParts = part.split(urlRegex);

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
            <span key={k}>{renderWithMentions(m, `s-${sIdx}-${j}-${k}`)}</span>
          )
        );
      }

      return renderWithMentions(urlSub, `p-${sIdx}-${j}`);
    });
  });
};

// Plain-text fast path: most chat messages contain no markdown. Running the
// full remark-gfm parser on every bubble on every render is the single
// biggest main-thread cost in long conversations, so plain messages skip
// ReactMarkdown entirely and render through the lightweight processText.
const MARKDOWN_HINT = /(\*\*|__|~~|`|#{1,6}\s|^\s*[-+*]\s|^\s*\d+\.\s|\[.+?\]\(.+?\)|^>\s|\|.+\||!\[)/m;

export const FormattedMessageText = memo(({ text, isMine, searchQuery, highlightNames }) => {
  const plain = useMemo(() => {
    if (typeof text !== "string") return false;
    if (text.includes("||")) return false; // spoiler syntax needs parser path
    return !MARKDOWN_HINT.test(text);
  }, [text]);

  if (!text) return null;

  if (plain) {
    return (
      <div className={`space-y-1 select-text break-words [overflow-wrap:anywhere] [word-break:break-word] min-w-0 max-w-full prose prose-sm ${isMine ? 'prose-invert' : ''} dark:prose-invert prose-p:my-1 prose-a:text-accent-primary prose-a:no-underline hover:prose-a:underline prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0`}>
        <div className="whitespace-pre-wrap leading-relaxed my-1">
          {processText(text, searchQuery, highlightNames)}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-1 select-text break-words [overflow-wrap:anywhere] [word-break:break-word] min-w-0 max-w-full prose prose-sm ${isMine ? 'prose-invert' : ''} dark:prose-invert prose-p:my-1 prose-a:text-accent-primary prose-a:no-underline hover:prose-a:underline prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({_node, className, children, ...props}) {
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
                        {typeof child === 'string' ? processText(child, searchQuery, highlightNames) : child}
                      </span>
                    ))
                  : typeof children === 'string'
                  ? processText(children, searchQuery, highlightNames)
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
                        {typeof child === 'string' ? processText(child, searchQuery, highlightNames) : child}
                      </span>
                    ))
                  : typeof children === 'string'
                  ? processText(children, searchQuery, highlightNames)
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
});

export default FormattedMessageText;
