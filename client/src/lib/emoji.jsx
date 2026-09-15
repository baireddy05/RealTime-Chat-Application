import twemoji from "@twemoji/api";

export const TWEMOJI_OPTIONS = {
  folder: "svg",
  ext: ".svg",
  base: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/",
};

/**
 * Escapes HTML characters to prevent XSS before parsing emojis
 */
export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Parses any string into safe HTML with crisp vector Twemoji SVG images
 */
export function parseEmojiToHtml(str, escape = true) {
  if (!str) return "";
  const safeStr = escape ? escapeHtml(str) : str;
  return twemoji.parse(safeStr, TWEMOJI_OPTIONS);
}

/**
 * Checks if a string consists strictly of emojis and whitespace
 */
export function isOnlyEmojis(str) {
  if (!str) return false;
  const trimmed = str.trim();
  if (!trimmed) return false;
  try {
    const parsed = twemoji.parse(trimmed, TWEMOJI_OPTIONS);
    const withoutImgs = parsed.replace(/<img[^>]+>/g, "").replace(/[\s\r\n\t]/g, "");
    return withoutImgs.length === 0;
  } catch {
    return false;
  }
}

/**
 * React Component to render any emoji or emoji-containing string as crisp vector SVGs
 */
export const EmojiSpan = ({ text, className = "", style = {} }) => {
  if (!text) return null;
  const html = parseEmojiToHtml(text, true);
  return (
    <span
      className={`inline-emoji-container ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
