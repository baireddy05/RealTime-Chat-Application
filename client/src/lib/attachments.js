// Shared attachment-type helpers so GIFs, stickers, and photos are labeled
// and rendered consistently everywhere (chat bubbles, sidebar previews,
// reply quotes, search snippets, exports).

export const isGifUrl = (url) => {
  if (typeof url !== "string" || !url) return false;
  const u = url.toLowerCase();
  return /\.gif(\?|#|$)/.test(u) || u.includes("tenor.com") || u.includes("giphy.gif");
};

export const isStickerUrl = (url) => {
  if (typeof url !== "string" || !url) return false;
  return url.includes("/stickers/") || url.includes("giphy-preview.gif") || url.includes("sticker");
};

/** "gif" | "sticker" | "photo" | null for an image-bearing message. */
export const imageKind = (msg) => {
  const url = msg?.image;
  if (!url) return null;
  if (msg?.isSticker || isStickerUrl(url)) return "sticker";
  if (isGifUrl(url)) return "gif";
  return "photo";
};

export const imageSnippet = (msg) => {
  switch (imageKind(msg)) {
    case "gif":
      return "🎞️ GIF";
    case "sticker":
      return "Sticker";
    default:
      return "📷 Photo";
  }
};
