import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  MapPin,
  Navigation,
  Loader2,
  RefreshCw,
  Send,
  Radio,
  Clock,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import MapTilePreview from "./MapTilePreview";
import { reverseGeocode, formatCoordinatesPair } from "../utils/location";

const LocationPickerModal = ({ isOpen, onClose, onSendLocation, onStartLiveShare, isLiveSharingAlready }) => {
  const [loadingGps, setLoadingGps] = useState(true);
  const [gpsError, setGpsError] = useState(null);
  const [coords, setCoords] = useState(null); // { lat, lng, accuracy }
  const [addressData, setAddressData] = useState({
    name: "Current Location",
    subtitle: "Locating...",
    fullAddress: "",
  });
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [caption, setCaption] = useState("");
  const [shareMode, setShareMode] = useState("static"); // "static" | "live"
  const [liveDuration, setLiveDuration] = useState(60); // minutes: 15, 60, 480
  const [sending, setSending] = useState(false);

  // Acquire current GPS position
  const fetchPosition = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      setLoadingGps(false);
      return;
    }

    setLoadingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ lat: latitude, lng: longitude, accuracy });
        setLoadingGps(false);

        // Fetch reverse geocoded address
        setLoadingAddress(true);
        reverseGeocode(latitude, longitude)
          .then((res) => {
            setAddressData({
              name: res.name || "Current Location",
              subtitle: res.subtitle,
              fullAddress: res.fullAddress,
            });
          })
          .catch(() => {})
          .finally(() => {
            setLoadingAddress(false);
          });
      },
      (err) => {
        setLoadingGps(false);
        let msg = "Unable to retrieve your location.";
        if (err.code === 1) {
          msg = "Location permission was denied. Please allow location access in your browser settings.";
        } else if (err.code === 2) {
          msg = "GPS position unavailable. Please check your network or device location.";
        } else if (err.code === 3) {
          msg = "Location request timed out. Please try again.";
        }
        setGpsError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000,
      }
    );
  };

  useEffect(() => {
    if (isOpen) {
      fetchPosition();
      setCaption("");
      setShareMode("static");
      setSending(false);
    }
  }, [isOpen]);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!coords || sending) return;
    setSending(true);

    try {
      if (shareMode === "live") {
        if (isLiveSharingAlready) {
          alert("You are already sharing live location. Stop the current share first.");
          setSending(false);
          return;
        }
        await onStartLiveShare({
          coords,
          minutes: liveDuration,
          name: addressData.name,
          address: addressData.fullAddress,
          caption: caption.trim(),
        });
      } else {
        await onSendLocation({
          lat: coords.lat,
          lng: coords.lng,
          name: addressData.name,
          address: addressData.fullAddress,
          caption: caption.trim(),
        });
      }
      onClose();
    } catch (e) {
      console.error("Failed to share location:", e);
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-[var(--bg-main)] border border-[var(--glass-border)] shadow-2xl overflow-hidden flex flex-col animate-scale-up"
        role="dialog"
        aria-modal="true"
        aria-label="Share Location"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent-primary/20 text-accent-primary flex items-center justify-center">
              <MapPin size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-theme-main">Share Location</h3>
              <p className="text-[11px] text-theme-muted">Send your GPS location to this chat</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4">
          {/* Map Preview Area */}
          <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-[var(--glass-border)] bg-black/20 shadow-inner">
            {loadingGps ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[var(--bg-secondary)]/40 p-4 text-center">
                <div className="relative flex items-center justify-center">
                  <span className="w-12 h-12 rounded-full bg-accent-primary/20 animate-ping absolute" />
                  <div className="w-10 h-10 rounded-full bg-accent-primary/30 text-accent-primary flex items-center justify-center relative">
                    <Navigation size={20} className="animate-spin-slow" />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-theme-main">Acquiring GPS position...</p>
                  <p className="text-[11px] text-theme-muted mt-0.5">Please allow browser location permissions if prompted</p>
                </div>
              </div>
            ) : gpsError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2.5 bg-red-500/10 p-4 text-center">
                <AlertCircle size={28} className="text-red-400" />
                <p className="text-xs font-medium text-red-300 max-w-xs">{gpsError}</p>
                <button
                  type="button"
                  onClick={fetchPosition}
                  className="mt-1 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw size={12} />
                  <span>Try Again</span>
                </button>
              </div>
            ) : coords ? (
              <>
                <MapTilePreview
                  lat={coords.lat}
                  lng={coords.lng}
                  zoom={15}
                  isLive={shareMode === "live"}
                />
                <button
                  type="button"
                  onClick={fetchPosition}
                  className="absolute top-2 right-2 p-1.5 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white text-xs shadow-md transition-all active:scale-95 flex items-center gap-1"
                  title="Refresh GPS"
                >
                  <RefreshCw size={12} />
                  <span className="text-[10px] font-medium pr-0.5">Refresh</span>
                </button>
                {coords.accuracy && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-mono">
                    ±{Math.round(coords.accuracy)}m accuracy
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Location Details Strip */}
          {coords && !gpsError && (
            <div className="p-3 rounded-2xl bg-[var(--bg-secondary)]/60 border border-[var(--glass-border)] flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-theme-main truncate">
                    {loadingAddress ? "Identifying landmark..." : addressData.name}
                  </span>
                  {loadingAddress && <Loader2 size={11} className="animate-spin text-accent-primary shrink-0" />}
                </div>
                <p className="text-[11px] text-theme-muted truncate mt-0.5">
                  {addressData.subtitle || formatCoordinatesPair(coords.lat, coords.lng)}
                </p>
              </div>
              <div className="text-[10px] font-mono text-theme-muted shrink-0 text-right">
                <div>{coords.lat.toFixed(4)}°</div>
                <div>{coords.lng.toFixed(4)}°</div>
              </div>
            </div>
          )}

          {/* Sharing Mode Selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShareMode("static")}
              className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                shareMode === "static"
                  ? "bg-accent-primary/15 border-accent-primary text-theme-main shadow-xs"
                  : "bg-[var(--bg-secondary)]/30 border-[var(--glass-border)] text-theme-muted hover:border-[var(--glass-border-hover)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MapPin size={15} className={shareMode === "static" ? "text-accent-primary" : ""} />
                  <span className="text-xs font-bold">Current Location</span>
                </div>
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                  shareMode === "static" ? "border-accent-primary bg-accent-primary text-white" : "border-zinc-500"
                }`}>
                  {shareMode === "static" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <p className="text-[10px] opacity-75">Send your fixed current spot</p>
            </button>

            <button
              type="button"
              onClick={() => setShareMode("live")}
              className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                shareMode === "live"
                  ? "bg-red-500/15 border-red-500 text-theme-main shadow-xs"
                  : "bg-[var(--bg-secondary)]/30 border-[var(--glass-border)] text-theme-muted hover:border-[var(--glass-border-hover)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Radio size={15} className={shareMode === "live" ? "text-red-500 animate-pulse" : ""} />
                  <span className="text-xs font-bold">Live Location</span>
                </div>
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                  shareMode === "live" ? "border-red-500 bg-red-500 text-white" : "border-zinc-500"
                }`}>
                  {shareMode === "live" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <p className="text-[10px] opacity-75">Updates live as you move</p>
            </button>
          </div>

          {/* Live Duration Selector (if Live mode selected) */}
          {shareMode === "live" && (
            <div className="p-3 rounded-2xl bg-red-500/5 border border-red-500/20 flex flex-col gap-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-theme-main flex items-center gap-1.5">
                  <Clock size={13} className="text-red-400" />
                  <span>Share duration</span>
                </span>
                <span className="text-[11px] text-red-400 font-medium">Auto-stops when expired</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "15 Minutes", val: 15 },
                  { label: "1 Hour", val: 60 },
                  { label: "8 Hours", val: 480 },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setLiveDuration(item.val)}
                    className={`py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      liveDuration === item.val
                        ? "bg-red-500 text-white shadow-xs"
                        : "bg-[var(--glass-bg)] border border-[var(--glass-border)] text-theme-muted hover:text-theme-main"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional Caption Input */}
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a note or landmark (optional)..."
              maxLength={200}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] text-xs text-theme-main placeholder-theme-muted focus:outline-none focus:border-accent-primary transition-colors"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 rounded-xl text-xs font-medium text-theme-muted hover:text-theme-main hover:bg-[var(--glass-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!coords || loadingGps || sending}
            className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${
              shareMode === "live"
                ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
                : "bg-accent-primary hover:bg-accent-primary/90 text-white shadow-accent-primary/20"
            }`}
          >
            {sending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Sharing...</span>
              </>
            ) : shareMode === "live" ? (
              <>
                <Radio size={14} className="animate-pulse" />
                <span>Start Live Sharing</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>Send Location</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LocationPickerModal;
