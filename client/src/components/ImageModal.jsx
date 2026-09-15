import { useState, useEffect } from "react";
import {
  X,
  Download,
  RotateCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Forward,
  ExternalLink,
  Check,
  Search,
  Send,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useChatStore } from "../store/useChatStore";

const ImageModal = ({ imageUrl, onClose }) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isForwardOpen, setIsForwardOpen] = useState(false);
  const [forwardSearch, setForwardSearch] = useState("");
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [caption, setCaption] = useState("");
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardSuccess, setForwardSuccess] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const { users, rooms, forwardMessage } = useChatStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isForwardOpen) {
          setIsForwardOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isForwardOpen]);

  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotateCw = () => setRotation((prev) => (prev + 90) % 360);
  const handleRotateCcw = () => setRotation((prev) => (prev - 90 + 360) % 360);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `photo-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn("Direct blob download failed, falling back to window open", err);
      const link = document.createElement("a");
      link.href = imageUrl;
      link.target = "_blank";
      link.download = `photo-${Date.now()}.png`;
      link.click();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendForward = async () => {
    if (!selectedTarget) return;
    setIsForwarding(true);
    try {
      const res = await forwardMessage({
        image: imageUrl,
        text: caption.trim(),
        targetChat: selectedTarget,
      });

      if (res?.success) {
        setForwardSuccess(true);
        setTimeout(() => {
          setForwardSuccess(false);
          setIsForwardOpen(false);
          setSelectedTarget(null);
          setCaption("");
        }, 900);
      }
    } catch (error) {
      console.error("Failed to forward:", error);
    } finally {
      setIsForwarding(false);
    }
  };

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(forwardSearch.toLowerCase())
  );
  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(forwardSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-2xl animate-fadeIn">
      {/* Top Floating Controls */}
      <div className="absolute top-4 inset-x-3 md:inset-x-8 z-20 pointer-events-none flex flex-col items-center gap-2 md:flex-row md:justify-between">
        <div className="bg-[var(--glass-heavy)] backdrop-blur-xl border border-[var(--glass-border)] rounded-full px-4 py-1.5 text-xs text-theme-muted pointer-events-auto flex items-center gap-2 shadow-glass">
          <span className="w-1.5 h-1.5 rounded-full bg-status-online" />
          <span className="font-medium text-theme-main">Photos</span>
          <span className="text-theme-muted/60">({Math.round(scale * 100)}% · {rotation}°)</span>
        </div>

        {/* Toolbar Buttons Floating Pill */}
        <div className="bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-full p-1 md:p-1.5 flex items-center gap-0.5 md:gap-1 shadow-glass pointer-events-auto">
          <button
            onClick={handleZoomOut}
            title="Zoom Out ( - )"
            className="p-1.5 md:p-2 hover:bg-[var(--glass-hover)] text-theme-muted hover:text-theme-main rounded-full transition-colors"
          >
            <ZoomOut size={15} />
          </button>

          <button
            onClick={handleZoomIn}
            title="Zoom In ( + )"
            className="p-1.5 md:p-2 hover:bg-[var(--glass-hover)] text-theme-muted hover:text-theme-main rounded-full transition-colors"
          >
            <ZoomIn size={15} />
          </button>

          <div className="w-[1px] h-4 bg-[var(--glass-border)] mx-0.5 hidden md:block" />

          <button
            onClick={handleRotateCcw}
            title="Rotate Left 90°"
            className="p-1.5 md:p-2 hover:bg-[var(--glass-hover)] text-theme-muted hover:text-theme-main rounded-full transition-colors hidden sm:flex"
          >
            <RotateCcw size={15} />
          </button>

          <button
            onClick={handleRotateCw}
            title="Rotate Right 90°"
            className="p-1.5 md:p-2 hover:bg-[var(--glass-hover)] text-theme-muted hover:text-theme-main rounded-full transition-colors hidden sm:flex"
          >
            <RotateCw size={15} />
          </button>

          {(scale !== 1 || rotation !== 0) && (
            <button
              onClick={handleReset}
              title="Reset Zoom & Rotation"
              className="p-1.5 md:p-2 hover:bg-[var(--glass-hover)] text-accent-primary rounded-full transition-colors"
            >
              <RefreshCw size={15} />
            </button>
          )}

          <div className="w-[1px] h-4 bg-[var(--glass-border)] mx-0.5" />

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            title="Save Image"
            className="p-1.5 md:p-2 hover:bg-[var(--glass-hover)] text-theme-muted hover:text-theme-main rounded-full transition-colors"
          >
            {isDownloading ? <Loader2 size={15} className="animate-spin text-accent-primary" /> : <Download size={15} />}
          </button>

          <button
            onClick={() => setIsForwardOpen(true)}
            title="Share"
            className="p-1.5 md:p-2 hover:bg-[var(--glass-hover)] text-theme-muted hover:text-accent-primary rounded-full transition-colors"
          >
            <Forward size={15} />
          </button>

          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open Original"
            className="p-1.5 md:p-2 hover:bg-[var(--glass-hover)] text-theme-muted hover:text-theme-main rounded-full transition-colors hidden sm:flex"
          >
            <ExternalLink size={15} />
          </a>

          <div className="w-[1px] h-4 bg-[var(--glass-border)] mx-0.5" />

          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 md:p-2 hover:bg-[var(--glass-hover)] text-theme-muted hover:text-theme-main rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="w-full h-full flex items-center justify-center p-4 md:p-8 overflow-hidden cursor-grab active:cursor-grabbing"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isForwardOpen) {
            onClose();
          }
        }}
      >
        <img
          src={imageUrl}
          alt="Preview Modal"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: "transform 0.25s cubic-bezier(0.2, 0, 0, 1)",
          }}
          className="max-h-[75vh] md:max-h-[82vh] max-w-[95vw] md:max-w-[85vw] object-contain rounded-2xl shadow-2xl select-none"
          draggable={false}
        />
      </div>

      {/* Forwarding Modal Dialog */}
      {isForwardOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--modal-backdrop)] backdrop-blur-xl p-4 animate-fadeIn">
          <div className="bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] w-full max-w-md rounded-3xl shadow-glass overflow-hidden flex flex-col max-h-[85vh] text-theme-main">
            <div className="px-5 py-4 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--glass-hover)]">
              <div className="flex items-center gap-2">
                <Forward size={18} className="text-accent-primary" />
                <h3 className="font-semibold text-sm text-theme-main">Share Image</h3>
              </div>
              <button
                onClick={() => setIsForwardOpen(false)}
                className="text-theme-muted hover:text-theme-main p-1 rounded-full hover:bg-[var(--glass-hover)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 border-b border-[var(--glass-border)]">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-theme-muted/50" />
                <input
                  type="text"
                  placeholder="Search channels or contacts..."
                  value={forwardSearch}
                  onChange={(e) => setForwardSearch(e.target.value)}
                  className="w-full glass-input border border-[var(--glass-border)] rounded-xl pl-9 pr-3 py-1.5 text-xs text-theme-main placeholder-theme-muted/40 focus:outline-none focus:border-accent-primary"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {filteredRooms.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider px-2 mb-1.5">
                    Channels
                  </h4>
                  <div className="space-y-1">
                    {filteredRooms.map((room) => {
                      const isSelected = selectedTarget?.type === "room" && selectedTarget?.id === room._id;
                      return (
                        <button
                          key={room._id}
                          onClick={() => setSelectedTarget({ id: room._id, type: "room", name: room.name })}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all text-xs ${
                            isSelected
                              ? "bg-accent-primary/20 border border-accent-primary/40 text-accent-primary font-medium"
                              : "hover:bg-[var(--glass-hover)] text-theme-main"
                          }`}
                        >
                          <span className="font-medium flex items-center gap-1.5">
                            {room.name.replace("#", "")}
                          </span>
                          {isSelected && <Check size={14} className="text-accent-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredUsers.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider px-2 mb-1.5">
                    Contacts
                  </h4>
                  <div className="space-y-1">
                    {filteredUsers.map((user) => {
                      const isSelected = selectedTarget?.type === "user" && selectedTarget?.id === user._id;
                      return (
                        <button
                          key={user._id}
                          onClick={() => setSelectedTarget({ id: user._id, type: "user", name: user.username })}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all text-xs ${
                            isSelected
                              ? "bg-accent-primary/20 border border-accent-primary/40 text-accent-primary font-medium"
                              : "hover:bg-[var(--glass-hover)] text-theme-main"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={user.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || "User")}`}
                              alt={user.username}
                              className="w-6 h-6 rounded-full bg-white/10 object-cover"
                            />
                            <span className="font-medium">{user.username}</span>
                          </div>
                          {isSelected && <Check size={14} className="text-accent-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredRooms.length === 0 && filteredUsers.length === 0 && (
                <div className="text-center text-theme-muted py-6 text-xs">
                  No matches found for "{forwardSearch}"
                </div>
              )}
            </div>

            <div className="p-3.5 border-t border-[var(--glass-border)] bg-[var(--glass-hover)] flex flex-col gap-2.5">
              <input
                type="text"
                placeholder="Add a message..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full glass-input border border-[var(--glass-border)] rounded-xl px-3 py-1.5 text-xs text-theme-main placeholder-theme-muted/40 focus:outline-none focus:border-accent-primary"
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-theme-muted">
                  {selectedTarget ? (
                    <>To: <strong className="text-theme-main font-medium">{selectedTarget.name}</strong></>
                  ) : (
                    "Select a recipient"
                  )}
                </span>

                <button
                  onClick={handleSendForward}
                  disabled={!selectedTarget || isForwarding || forwardSuccess}
                  className="px-4 py-1.5 rounded-xl bg-accent-primary hover:bg-accent-primary/80 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-md shadow-accent-primary/25"
                >
                  {isForwarding ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-white" />
                      Sending...
                    </>
                  ) : forwardSuccess ? (
                    <>
                      <Check size={13} className="text-white" />
                      Sent
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      Send
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageModal;
