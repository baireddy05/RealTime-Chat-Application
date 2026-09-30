import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  MapPin,
  Navigation,
  ExternalLink,
  Copy,
  Check,
  Share2,
  Compass,
  Layers,
  StopCircle,
  Loader2,
} from "lucide-react";
import {
  reverseGeocode,
  formatCoordinatesPair,
  getGoogleMapsUrl,
  getGoogleDirectionsUrl,
  getAppleMapsUrl,
  getGoogleEmbedUrl,
  getOpenStreetMapEmbedUrl,
} from "../utils/location";
import { useChatStore } from "../store/useChatStore";

const LocationModal = ({ location, message, isMine, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [mapProvider, setMapProvider] = useState("google"); // "google" | "osm"
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [addressInfo, setAddressInfo] = useState({
    name: location?.name || "Shared Location",
    subtitle: "",
    fullAddress: location?.address || "",
    city: "",
    state: "",
    country: "",
  });
  const [stopping, setStopping] = useState(false);

  const numLat = Number(location?.lat);
  const numLng = Number(location?.lng);
  const valid = Number.isFinite(numLat) && Number.isFinite(numLng);

  const isLive = Boolean(
    message?.liveUntil &&
    !isNaN(new Date(message.liveUntil).getTime()) &&
    new Date(message.liveUntil).getTime() > Date.now()
  );

  const [remainingSecs, setRemainingSecs] = useState(() => {
    if (!isLive) return 0;
    return Math.max(0, Math.floor((new Date(message.liveUntil).getTime() - Date.now()) / 1000));
  });

  // Countdown timer for live location
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.floor((new Date(message.liveUntil).getTime() - Date.now()) / 1000));
      setRemainingSecs(left);
      if (left <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive, message?.liveUntil]);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    const prev = document.body.style.overflow;
    try {
      document.body.style.overflow = "hidden";
    } catch {}

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      try {
        document.body.style.overflow = prev;
      } catch {}
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Fetch reverse-geocoded address
  useEffect(() => {
    let active = true;
    if (!valid) {
      setLoadingAddress(false);
      return;
    }

    // If pre-filled on message, start with that
    if (location?.name) {
      setAddressInfo((prev) => ({
        ...prev,
        name: location.name,
        fullAddress: location.address || prev.fullAddress,
      }));
    }

    setLoadingAddress(true);
    reverseGeocode(numLat, numLng)
      .then((res) => {
        if (!active) return;
        setAddressInfo({
          name: location?.name || res.name,
          subtitle: res.subtitle,
          fullAddress: location?.address || res.fullAddress,
          city: res.city,
          state: res.state,
          country: res.country,
        });
      })
      .finally(() => {
        if (active) setLoadingAddress(false);
      });

    return () => {
      active = false;
    };
  }, [numLat, numLng, valid, location?.name, location?.address]);

  const handleCopyCoordinates = async () => {
    if (!valid) return;
    try {
      await navigator.clipboard.writeText(`${numLat.toFixed(6)}, ${numLng.toFixed(6)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleShare = async () => {
    if (!valid) return;
    const url = getGoogleMapsUrl(numLat, numLng);
    const title = addressInfo.name || "Shared Location";
    const text = `Location: ${title} (${formatCoordinatesPair(numLat, numLng)})`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {}
    }
    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleStopLive = async () => {
    if (!message?._id || stopping) return;
    setStopping(true);
    try {
      await useChatStore.getState().stopLiveLocation(message._id);
    } catch {}
    setStopping(false);
  };

  const formatRemainingTime = (totalSec) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) return `${hours}h ${mins}m left`;
    if (mins > 0) return `${mins}m ${secs}s left`;
    return `${secs}s left`;
  };

  const embedUrl = mapProvider === "google"
    ? getGoogleEmbedUrl(numLat, numLng, 16)
    : getOpenStreetMapEmbedUrl(numLat, numLng);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-[var(--bg-main)] border border-[var(--glass-border)] shadow-2xl overflow-hidden animate-scale-up"
        role="dialog"
        aria-modal="true"
        aria-label="Location Details"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
              isLive
                ? "bg-red-500/20 text-red-500 ring-2 ring-red-500/30"
                : "bg-accent-primary/20 text-accent-primary ring-2 ring-accent-primary/30"
            }`}>
              {isLive ? <Navigation size={20} className="animate-pulse" /> : <MapPin size={20} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-theme-main truncate">
                  {addressInfo.name || "Shared Location"}
                </h3>
                {isLive && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold tracking-wider flex items-center gap-1 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-theme-muted truncate mt-0.5">
                {loadingAddress ? (
                  <span className="inline-flex items-center gap-1.5 text-theme-muted/80">
                    <Loader2 size={12} className="animate-spin" /> Resolving address...
                  </span>
                ) : (
                  addressInfo.subtitle || formatCoordinatesPair(numLat, numLng)
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Map Provider Toggle */}
            <div className="hidden sm:flex items-center p-0.5 rounded-xl bg-black/10 dark:bg-white/10 text-xs">
              <button
                type="button"
                onClick={() => setMapProvider("google")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  mapProvider === "google"
                    ? "bg-accent-primary text-white shadow-xs"
                    : "text-theme-muted hover:text-theme-main"
                }`}
              >
                Google
              </button>
              <button
                type="button"
                onClick={() => setMapProvider("osm")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  mapProvider === "osm"
                    ? "bg-accent-primary text-white shadow-xs"
                    : "text-theme-muted hover:text-theme-main"
                }`}
              >
                OSM
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors active:scale-95"
              title="Close (Esc)"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Live Notification Bar if Live Share */}
        {isLive && (
          <div className="px-4 sm:px-6 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between gap-3 text-xs text-red-500 font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>Live Location Active • {formatRemainingTime(remainingSecs)}</span>
            </div>
            {isMine && (
              <button
                type="button"
                onClick={handleStopLive}
                disabled={stopping}
                className="px-2.5 py-1 rounded-lg bg-red-500 text-white font-semibold text-[11px] hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1 shadow-xs"
              >
                <StopCircle size={13} />
                <span>{stopping ? "Stopping..." : "Stop Sharing"}</span>
              </button>
            )}
          </div>
        )}

        {/* Interactive Map Embed */}
        <div className="relative w-full h-[320px] sm:h-[400px] bg-black/10 dark:bg-black/40 overflow-hidden">
          {valid ? (
            <iframe
              title="Interactive Map"
              src={embedUrl}
              className="w-full h-full border-0 select-none"
              loading="lazy"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-theme-muted text-sm gap-2">
              <MapPin size={32} className="opacity-40" />
              <span>Coordinates unavailable</span>
            </div>
          )}

          {/* Quick Compass Tag */}
          <div className="absolute top-3 left-3 pointer-events-none px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-mono flex items-center gap-1.5 shadow-lg">
            <Compass size={13} className="text-accent-primary animate-spin-slow" />
            <span>{formatCoordinatesPair(numLat, numLng)}</span>
          </div>

          {/* Floating Mobile Provider Switcher */}
          <div className="sm:hidden absolute top-3 right-3 flex items-center p-0.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-[10px]">
            <button
              type="button"
              onClick={() => setMapProvider("google")}
              className={`px-2 py-0.5 rounded-lg ${mapProvider === "google" ? "bg-accent-primary text-white" : "text-white/70"}`}
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => setMapProvider("osm")}
              className={`px-2 py-0.5 rounded-lg ${mapProvider === "osm" ? "bg-accent-primary text-white" : "text-white/70"}`}
            >
              OSM
            </button>
          </div>
        </div>

        {/* Address & Detail Info Section */}
        <div className="px-4 sm:px-6 py-3.5 bg-[var(--bg-secondary)]/30 border-t border-[var(--glass-border)] flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-theme-main break-words">
                {addressInfo.fullAddress || "Address not available"}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-theme-muted font-mono">
                <span>{numLat.toFixed(6)}, {numLng.toFixed(6)}</span>
                <span>•</span>
                <span>WGS84</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyCoordinates}
              className="shrink-0 px-2.5 py-1 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)] text-xs text-theme-main font-medium flex items-center gap-1.5 transition-colors active:scale-95"
              title="Copy GPS coordinates"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-green-500" />
                  <span className="text-green-500">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="px-4 sm:px-6 py-3 border-t border-[var(--glass-border)] bg-[var(--bg-main)] flex flex-wrap items-center justify-between gap-2.5">
          {/* External Navigation Links */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Get Directions (Primary Action) */}
            <a
              href={getGoogleDirectionsUrl(numLat, numLng)}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-accent-primary/20 transition-all active:scale-95"
            >
              <Navigation size={14} className="fill-white" />
              <span>Get Directions</span>
            </a>

            {/* Google Maps link */}
            <a
              href={getGoogleMapsUrl(numLat, numLng)}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)] text-xs text-theme-main font-medium flex items-center gap-1.5 transition-colors"
            >
              <span>Google Maps</span>
              <ExternalLink size={12} className="opacity-70" />
            </a>

            {/* Apple Maps link */}
            <a
              href={getAppleMapsUrl(numLat, numLng, addressInfo.name)}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)] text-xs text-theme-main font-medium flex items-center gap-1.5 transition-colors"
            >
              <span>Apple Maps</span>
              <ExternalLink size={12} className="opacity-70" />
            </a>
          </div>

          {/* Share / Close */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleShare}
              className="p-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)] text-theme-main transition-colors active:scale-95"
              title="Share Location"
            >
              <Share2 size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[var(--glass-border)] hover:bg-[var(--glass-hover)] text-xs text-theme-main font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LocationModal;
