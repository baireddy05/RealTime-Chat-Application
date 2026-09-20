import { useState, useEffect, useRef } from "react";
import { axiosInstance } from "../lib/axios";
import { Link as LinkIcon, Loader } from "lucide-react";

// Module-level cache: the same URL shared/forwarded across chats fetches once.
const previewCache = new Map(); // url -> preview object (or null when none)
const MAX_PREVIEW_CACHE = 200;

const LinkPreview = ({ url }) => {
  const [preview, setPreview] = useState(() => (previewCache.has(url) ? previewCache.get(url) : undefined));
  const [loading, setLoading] = useState(() => !previewCache.has(url));
  const [isVisible, setIsVisible] = useState(false);
  const placeholderRef = useRef(null);

  // Only fetch when the bubble scrolls into view: opening a chat with many
  // links no longer fires N preview requests + N re-renders up front.
  useEffect(() => {
    const el = placeholderRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    if (previewCache.has(url)) {
      setPreview(previewCache.get(url));
      setLoading(false);
      return;
    }
    let isMounted = true;

    const fetchPreview = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get("/chat/preview-link", {
          params: { url },
        });

        if (isMounted && res.data && res.data.title && !res.data.error) {
          if (previewCache.size >= MAX_PREVIEW_CACHE) {
            previewCache.delete(previewCache.keys().next().value);
          }
          previewCache.set(url, res.data);
          setPreview(res.data);
        } else if (isMounted) {
          previewCache.set(url, null);
          setPreview(null);
        }
      } catch (error) {
        console.error("Failed to fetch link preview:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
    };
  }, [url, isVisible]);

  if (!isVisible) {
    return <div ref={placeholderRef} className="mt-2 h-10" />;
  }

  if (loading) {
    return (
      <div ref={placeholderRef} className="mt-2 flex items-center justify-center p-4 bg-[var(--glass-hover)] border border-[var(--glass-border)] rounded-2xl animate-pulse">
        <Loader size={16} className="text-theme-muted animate-spin" />
      </div>
    );
  }

  if (!preview) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex flex-col sm:flex-row overflow-hidden rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] hover:bg-[var(--glass-hover)] transition-all cursor-pointer shadow-glass group max-w-sm"
    >
      {preview.image && (
        <div className="sm:w-24 sm:h-auto h-32 flex-shrink-0 bg-theme-muted/10 overflow-hidden relative">
          <img
            src={preview.image}
            alt={preview.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.parentElement.classList.add("hidden");
            }}
          />
        </div>
      )}

      <div className="p-2.5 flex flex-col justify-center min-w-0 flex-1">
        <h4 className="text-[12px] font-semibold text-theme-main line-clamp-1 group-hover:text-accent-primary transition-colors">
          {preview.title}
        </h4>
        {preview.description && (
          <p className="text-[10px] text-theme-muted mt-0.5 line-clamp-2 leading-snug">
            {preview.description}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5 text-accent-secondary">
          <LinkIcon size={10} />
          <span className="text-[9px] font-medium tracking-wide uppercase">
            {preview.siteName || new URL(url).hostname}
          </span>
        </div>
      </div>
    </a>
  );
};

export default LinkPreview;
