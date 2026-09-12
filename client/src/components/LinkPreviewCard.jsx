import { ExternalLink, Globe } from "lucide-react";

const LinkPreviewCard = ({ preview, isMine }) => {
  if (!preview || !preview.url) return null;

  const domain = (() => {
    try {
      return new URL(preview.url).hostname.replace(/^www\./, "");
    } catch {
      return preview.siteName || "link";
    }
  })();

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`mt-2 block rounded-2xl overflow-hidden border transition-all text-left group ${
        isMine
          ? "bg-white/10 border-white/20 hover:bg-white/15"
          : "bg-[var(--glass-surface)] border-[var(--glass-border)] hover:border-accent-primary/50 shadow-glass"
      }`}
    >
      {preview.image && (
        <div className="relative w-full h-36 bg-black/40 overflow-hidden">
          <img
            src={preview.image}
            alt={preview.title || "Preview"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        </div>
      )}
      <div className="p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] text-accent-primary font-medium">
          <Globe size={11} />
          <span className="uppercase tracking-wider truncate">{preview.siteName || domain}</span>
          <ExternalLink size={10} className="ml-auto opacity-70 group-hover:opacity-100" />
        </div>
        {preview.title && (
          <h5 className="font-semibold text-[13px] text-theme-main line-clamp-1 group-hover:text-accent-primary transition-colors">
            {preview.title}
          </h5>
        )}
        {preview.description && (
          <p className="text-[11px] text-theme-muted line-clamp-2 leading-relaxed">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
};

export default LinkPreviewCard;
