import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import { Link as LinkIcon, Loader } from "lucide-react";

const LinkPreview = ({ url }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchPreview = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get("/chat/preview-link", {
          params: { url },
        });
        
        if (isMounted && res.data && res.data.title && !res.data.error) {
          setPreview(res.data);
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
  }, [url]);

  if (loading) {
    return (
      <div className="mt-2 flex items-center justify-center p-4 bg-[var(--glass-hover)] border border-[var(--glass-border)] rounded-2xl animate-pulse">
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
