import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useCallStore } from "../store/useCallStore";
import { useBackHandler } from "../lib/backNavigation";
import { 
  PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, 
  Sparkles, Monitor, MonitorOff, SwitchCamera, Smartphone, 
  RectangleHorizontal, ArrowLeftRight 
} from "lucide-react";

const formatCallTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

const CallModal = () => {
  const {
    callState,
    callType,
    peerUser,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isPeerMuted,
    isPeerVideoOff,
    isSpeakerOn,
    isScreenSharing,
    screenStream,
    currentFacingMode,
    isSwapped,
    callDuration,
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    toggleScreenShare,
    switchCamera,
    toggleSwapVideo,
  } = useCallStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [reactions, setReactions] = useState([]);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  
  // Aspect ratio mode: 'auto' | 'portrait' | 'landscape' (manual PiP override)
  const [aspectMode, setAspectMode] = useState("auto");
  // Track actual captured dimensions for BOTH ends so portrait stays portrait
  // on the publisher's phone AND on the receiver's laptop.
  const [localVideoSize, setLocalVideoSize] = useState({ w: 0, h: 0 });
  const [remoteVideoSize, setRemoteVideoSize] = useState({ w: 0, h: 0 });
  const [isWindowPortrait, setIsWindowPortrait] = useState(
    typeof window !== "undefined" ? window.innerHeight > window.innerWidth : false
  );

  // Android / Mobile back gesture interception
  useBackHandler(callState === "calling" || callState === "connected", endCall, "active_call_modal");

  const canScreenShare = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia);

  const triggerReaction = useCallback((emoji = "🔥") => {
    const id = Date.now() + Math.random();
    const left = Math.floor(Math.random() * 60) + 20;
    setReactions((prev) => [...prev, { id, emoji, left }]);
    setShowReactionPicker(false);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 1500);
  }, []);

  const isConnected = callState === "connected";
  const hasRemoteVideo = isConnected && 
    callType === "video" && 
    !isPeerVideoOff && 
    Boolean(remoteStream && remoteStream.getVideoTracks().some((t) => t.readyState === "live"));

  // Read dimensions from a <video> element (publisher's real orientation)
  const readVideoSize = (videoEl) => {
    if (!videoEl) return null;
    const { videoWidth, videoHeight } = videoEl;
    if (videoWidth && videoHeight) return { w: videoWidth, h: videoHeight };
    return null;
  };

  const handleLocalMetadata = useCallback((e) => {
    const size = readVideoSize(e.target);
    if (size) setLocalVideoSize(size);
  }, []);

  const handleRemoteMetadata = useCallback((e) => {
    const size = readVideoSize(e.target);
    if (size) setRemoteVideoSize(size);
  }, []);

  // <video> fires `resize` when the track dimensions change mid-call
  // (e.g. phone rotated from portrait to landscape). Keep both ends in sync.
  const handleLocalResize = useCallback((e) => {
    const size = readVideoSize(e.target);
    if (size) setLocalVideoSize((prev) => (prev.w === size.w && prev.h === size.h ? prev : size));
  }, []);

  const handleRemoteResize = useCallback((e) => {
    const size = readVideoSize(e.target);
    if (size) setRemoteVideoSize((prev) => (prev.w === size.w && prev.h === size.h ? prev : size));
  }, []);

  // Track window and stream orientation (fallback when metadata not ready yet)
  const checkOrientation = useCallback(() => {
    if (typeof window !== "undefined") {
      setIsWindowPortrait(window.innerHeight > window.innerWidth);
    }
    const localSize = readVideoSize(localVideoRef.current);
    if (localSize) {
      setLocalVideoSize((prev) => (prev.w === localSize.w && prev.h === localSize.h ? prev : localSize));
    } else if (localStream) {
      // Fall back to the capture track settings (works before first frame)
      const track = localStream.getVideoTracks?.()?.[0];
      const settings = track?.getSettings?.();
      if (settings?.width && settings?.height) {
        setLocalVideoSize((prev) =>
          prev.w === settings.width && prev.h === settings.height
            ? prev
            : { w: settings.width, h: settings.height }
        );
      }
    }
    const remoteSize = readVideoSize(remoteVideoRef.current);
    if (remoteSize) {
      setRemoteVideoSize((prev) => (prev.w === remoteSize.w && prev.h === remoteSize.h ? prev : remoteSize));
    } else if (remoteStream) {
      const track = remoteStream.getVideoTracks?.()?.[0];
      const settings = track?.getSettings?.();
      if (settings?.width && settings?.height) {
        setRemoteVideoSize((prev) =>
          prev.w === settings.width && prev.h === settings.height
            ? prev
            : { w: settings.width, h: settings.height }
        );
      }
    }
  }, [localStream, remoteStream]);

  useEffect(() => {
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, [checkOrientation]);

  // Callback refs to instantly attach streams whenever elements mount or swap
  const bindLocalVideo = useCallback((node) => {
    localVideoRef.current = node;
    if (node) {
      const streamToBind = isScreenSharing && screenStream ? screenStream : localStream;
      if (node.srcObject !== streamToBind) {
        node.srcObject = streamToBind;
      }
      node.play?.().catch(() => {});
      const size = readVideoSize(node);
      if (size) setLocalVideoSize(size);
      else checkOrientation();
    }
  }, [localStream, screenStream, isScreenSharing, checkOrientation]);

  const bindRemoteVideo = useCallback((node) => {
    remoteVideoRef.current = node;
    if (node && remoteStream) {
      if (node.srcObject !== remoteStream) {
        node.srcObject = remoteStream;
      }
      node.play?.().catch(() => {});
      const size = readVideoSize(node);
      if (size) setRemoteVideoSize(size);
    }
  }, [remoteStream]);

  // Synchronize local stream changes
  useEffect(() => {
    if (localVideoRef.current) {
      const streamToBind = isScreenSharing && screenStream ? screenStream : localStream;
      if (localVideoRef.current.srcObject !== streamToBind) {
        localVideoRef.current.srcObject = streamToBind;
      }
      localVideoRef.current.play?.().catch(() => {});
      checkOrientation();
    }
  }, [localStream, screenStream, isScreenSharing, isSwapped, checkOrientation]);

  // Synchronize remote video
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.play?.().catch(() => {});
    }
  }, [remoteStream, isSwapped, hasRemoteVideo]);

  // Dedicated remote audio playback and speaker volume control
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      if (remoteAudioRef.current.srcObject !== remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
      remoteAudioRef.current.muted = !isSpeakerOn;
      remoteAudioRef.current.play?.().catch((err) => {
        console.warn("[PulseCall] Remote audio autoplay deferred:", err);
      });
    }
  }, [remoteStream, isSpeakerOn, callState, isConnected]);

  if (callState !== "calling" && callState !== "connected") {
    return null;
  }

  // Orientation of each publisher: portrait video stays portrait on BOTH ends.
  const isLocalPortrait = localVideoSize.h > 0 && localVideoSize.w > 0
    ? localVideoSize.h > localVideoSize.w
    : isWindowPortrait;
  const isRemotePortrait = remoteVideoSize.h > 0 && remoteVideoSize.w > 0
    ? remoteVideoSize.h > remoteVideoSize.w
    : false;

  // Which stream is currently on the main stage vs the mini preview?
  // Normal: main = remote, PiP = local. Swapped: main = local, PiP = remote.
  const mainShowsLocal = isSwapped;
  const autoMainPortrait = isScreenSharing && mainShowsLocal
    ? false // shared screens are landscape
    : mainShowsLocal
    ? isLocalPortrait
    : hasRemoteVideo
    ? isRemotePortrait
    : isLocalPortrait;
  const autoPipPortrait = isScreenSharing && !mainShowsLocal
    ? false
    : mainShowsLocal
    ? (hasRemoteVideo ? isRemotePortrait : false)
    : isLocalPortrait;

  // Manual override (PiP corner button) wins when not 'auto'.
  const isMainPortrait = aspectMode === "portrait" ? true : aspectMode === "landscape" ? false : autoMainPortrait;
  const isPipPortrait = aspectMode === "portrait" ? true : aspectMode === "landscape" ? false : autoPipPortrait;

  const cycleAspectMode = (e) => {
    e.stopPropagation();
    setAspectMode((prev) => {
      if (prev === "auto") return "portrait";
      if (prev === "portrait") return "landscape";
      return "auto";
    });
  };

  const modalContent = (
    <div 
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] w-screen h-screen h-[100dvh] apple-ambient-bg flex flex-col items-center justify-between p-3 sm:p-4 md:p-6 animate-fadeIn text-theme-main select-none backdrop-blur-3xl overflow-hidden"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100dvh",
        zIndex: 9999,
      }}
      onClick={() => {
        // Unlock audio context on mobile touch if blocked
        if (remoteAudioRef.current && remoteAudioRef.current.paused) {
          remoteAudioRef.current.play().catch(() => {});
        }
      }}
    >
      {/* Dynamic Ambient Blur Glows */}
      <div className="fixed -top-32 -left-32 w-[480px] h-[480px] rounded-full blur-spot-1 pointer-events-none z-0 opacity-40 animate-pulse-slow" />
      <div className="fixed -bottom-32 -right-32 w-[520px] h-[520px] rounded-full blur-spot-2 pointer-events-none z-0 opacity-40 animate-pulse-slow" />

      {/* Dedicated audio element for crystal-clear remote WebRTC audio playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Top Header Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10 glass-panel px-3.5 sm:px-5 py-2 sm:py-3 rounded-2xl border border-[var(--glass-border)] shadow-glass backdrop-blur-2xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-accent-primary/15 text-accent-primary shrink-0">
            {callType === "video" ? <Video size={18} /> : <Sparkles size={18} />}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm tracking-tight capitalize text-theme-main flex items-center gap-1.5 truncate">
              <span className="truncate">{peerUser?.name || peerUser?.username || "Pulse User"}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary font-medium shrink-0">
                {callType === "video" ? "HD Video" : "Voice"}
              </span>
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-theme-muted">
              <span>{isConnected ? "Connected" : "Calling..."}</span>
              {isPeerMuted && (
                <span className="inline-flex items-center gap-0.5 text-red-400 font-medium">
                  <MicOff size={11} /> Muted
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status / Duration */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-variant font-mono text-[10px] text-secondary font-semibold border border-[var(--glass-border)]">
            HD 60fps
          </span>
          <div className="px-3 py-1 rounded-full bg-[var(--glass-surface)] border border-[var(--glass-border)] shadow-sm">
            <span className="text-xs font-mono font-medium tracking-wide">
              {isConnected ? (
                <span className="text-status-online flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-online animate-pulse" />
                  {formatCallTime(callDuration)}
                </span>
              ) : (
                <span className="text-amber-400 animate-pulse">Calling...</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Main View Area — portrait publisher => portrait stage on BOTH phone & laptop */}
      <div
        data-layout={isMainPortrait ? "portrait" : "landscape"}
        className="w-full max-w-4xl flex-1 my-2 sm:my-3 relative rounded-3xl overflow-hidden glass-panel border border-[var(--glass-border)] shadow-glass flex items-center justify-center bg-black backdrop-blur-xl z-10 min-h-0"
      >
        {callType === "video" ? (
          <>
            {/* Primary Main Video (Remote or Swapped Local) */}
            {!isSwapped ? (
              hasRemoteVideo ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black min-h-0">
                  <video
                    ref={bindRemoteVideo}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={handleRemoteMetadata}
                    onResize={handleRemoteResize}
                    className={
                      isMainPortrait
                        ? "h-full w-auto aspect-[9/16] max-w-full object-cover"
                        : "w-full h-full object-cover"
                    }
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-5 text-center p-6 animate-fadeIn">
                  <div className="relative">
                    <div className="w-24 sm:w-32 h-24 sm:h-32 rounded-full border-2 border-[var(--glass-border)] shadow-2xl overflow-hidden bg-slate-800 flex items-center justify-center">
                      {peerUser?.profilePic ? (
                        <img
                          src={peerUser.profilePic}
                          alt="Peer avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                            peerUser?.name || "User"
                          )}&background=2563eb&color=ffffff&size=128`}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="absolute -inset-2 rounded-full border border-accent-primary/40 animate-ping pointer-events-none" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold capitalize tracking-tight text-theme-main">
                      {peerUser?.name || peerUser?.username}
                    </h2>
                    <p className="text-xs text-theme-muted mt-1">
                      {isPeerVideoOff 
                        ? "Camera is turned off" 
                        : isConnected 
                        ? "Waiting for video..." 
                        : "Waiting for recipient to accept..."}
                    </p>
                  </div>
                </div>
              )
            ) : (
              /* Swapped: Local stream on main canvas — keeps its own orientation */
              <div className="absolute inset-0 flex items-center justify-center bg-black min-h-0">
                <video
                  ref={bindLocalVideo}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={handleLocalMetadata}
                  onResize={handleLocalResize}
                  className={`${
                    isMainPortrait
                      ? "h-full w-auto aspect-[9/16] max-w-full object-cover"
                      : "w-full h-full object-cover"
                  } ${
                    currentFacingMode === "user" && !isScreenSharing ? "-scale-x-100" : ""
                  } ${isVideoOff ? "hidden" : "block"}`}
                />
              </div>
            )}

            {/* Screen Share Active Badge */}
            {isScreenSharing && (
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium backdrop-blur-md animate-pulse shadow-md">
                <Monitor size={13} />
                <span>Screen Share Active</span>
              </div>
            )}

            {/* Portrait-stage badge: shows when the publisher on main stage is portrait (mobile) */}
            {!isScreenSharing && isMainPortrait && (mainShowsLocal ? !isVideoOff : hasRemoteVideo) && (
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 border border-white/15 text-white/85 text-[10px] font-medium backdrop-blur-md shadow-md">
                <Smartphone size={12} />
                <span>Portrait</span>
              </div>
            )}

            {/* Floating Live Reactions Layer */}
            <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
              {reactions.map((r) => (
                <div
                  key={r.id}
                  style={{ left: `${r.left}%` }}
                  className="absolute bottom-16 text-3xl animate-bounce transform -translate-y-24 transition-all duration-1000"
                >
                  {r.emoji}
                </div>
              ))}
            </div>

            {/* Picture-in-Picture (PiP) Video Preview — mirrors its own publisher */}
            <div
              onClick={toggleSwapVideo}
              title="Click to swap main view and mini view"
              data-layout={isPipPortrait ? "portrait" : "landscape"}
              className={`absolute bottom-3 sm:bottom-4 right-3 sm:right-4 z-20 cursor-pointer overflow-hidden rounded-2xl border-2 border-[var(--glass-border)] shadow-2xl bg-slate-950 backdrop-blur-xl transition-all duration-300 hover:scale-105 group ${
                isPipPortrait
                  ? "w-24 sm:w-32 md:w-36 aspect-[3/4]"
                  : "w-32 sm:w-44 md:w-48 aspect-video"
              }`}
            >
              {!isSwapped ? (
                /* Normal PiP: Local Camera Preview */
                <>
                  <video
                    ref={bindLocalVideo}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={handleLocalMetadata}
                    onResize={handleLocalResize}
                    className={`w-full h-full object-cover ${
                      currentFacingMode === "user" && !isScreenSharing ? "-scale-x-100" : ""
                    } ${isVideoOff ? "hidden" : "block"}`}
                  />
                  {isVideoOff && (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-theme-muted text-[10px] gap-1 p-2 text-center">
                      <VideoOff size={16} />
                      <span>Camera Off</span>
                    </div>
                  )}
                </>
              ) : (
                /* Swapped PiP: Remote Stream in Mini Box */
                <>
                  {hasRemoteVideo ? (
                    <video
                      ref={bindRemoteVideo}
                      autoPlay
                      playsInline
                      muted
                      onLoadedMetadata={handleRemoteMetadata}
                      onResize={handleRemoteResize}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-theme-muted text-[10px] gap-1 p-2 text-center">
                      <VideoOff size={16} />
                      <span>{peerUser?.name || "Peer"}</span>
                    </div>
                  )}
                </>
              )}

              {/* PiP Overlay Controls */}
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-md p-0.5 rounded-lg">
                {/* Switch Camera Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    switchCamera();
                  }}
                  className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
                  title="Switch Camera (Front/Rear)"
                >
                  <SwitchCamera size={13} />
                </button>

                {/* Aspect Ratio Toggle */}
                <button
                  type="button"
                  onClick={cycleAspectMode}
                  className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
                  title={`Aspect Ratio: ${aspectMode.toUpperCase()}`}
                >
                  {isPipPortrait ? <RectangleHorizontal size={13} /> : <Smartphone size={13} />}
                </button>

                {/* Swap View Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSwapVideo();
                  }}
                  className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
                  title="Swap with Main Screen"
                >
                  <ArrowLeftRight size={13} />
                </button>
              </div>

              {/* PiP Label Badge */}
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[9.5px] font-medium text-white/90 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md">
                <span>{!isSwapped ? "You" : peerUser?.name || "Peer"}</span>
                {isPipPortrait && (
                  <span className="text-[8px] text-accent-primary font-mono font-semibold">9:16</span>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Audio Call Visualizer */
          <div className="flex flex-col items-center justify-center gap-6 p-6 animate-fadeIn">
            <div className="relative flex items-center justify-center">
              {/* Pulsing Audio Waves */}
              {isConnected && (
                <>
                  <div className="absolute w-44 h-44 rounded-full bg-accent-primary/10 animate-ping [animation-duration:3s]" />
                  <div className="absolute w-56 h-56 rounded-full bg-accent-primary/5 animate-pulse [animation-duration:2s]" />
                </>
              )}
              <div className="w-28 sm:w-32 h-28 sm:h-32 rounded-full border-4 border-[var(--glass-border)] shadow-2xl overflow-hidden bg-slate-800 z-10 relative">
                {peerUser?.profilePic ? (
                  <img
                    src={peerUser.profilePic}
                    alt="Peer avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                      peerUser?.name || "User"
                    )}&background=2563eb&color=ffffff&size=128`}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>

            <div className="text-center z-10">
              <h2 className="text-xl sm:text-2xl font-bold capitalize tracking-tight text-theme-main">
                {peerUser?.name || peerUser?.username}
              </h2>
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <p className="text-xs text-theme-muted font-medium">
                  {isConnected ? (
                    <span className="text-emerald-400 font-mono tracking-wider">
                      {formatCallTime(callDuration)}
                    </span>
                  ) : (
                    "Calling..."
                  )}
                </p>
                {isPeerMuted && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-red-400 font-medium px-2 py-0.5 rounded-full bg-red-500/10">
                    <MicOff size={11} /> Peer Muted
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Dock (Responsive, Mobile Touch Friendly) */}
      <div className="z-20 flex items-center justify-center gap-1.5 sm:gap-3.5 bg-[var(--glass-heavy)] backdrop-blur-3xl border border-[var(--glass-border)] px-3 sm:px-6 py-2 sm:py-3.5 rounded-full shadow-glass animate-slideUp max-w-[95vw] overflow-x-auto no-scrollbar call-safe-bottom">
        {/* Mute Button */}
        <button
          type="button"
          onClick={toggleMute}
          className={`p-2.5 sm:p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md shrink-0 active:scale-95 ${
            isMuted
              ? "bg-red-500 text-white scale-105"
              : "bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] text-theme-main border border-[var(--glass-border)]"
          }`}
          title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          {isMuted ? <MicOff size={17} /> : <Mic size={17} />}
        </button>

        {/* Video Toggle (if video call) */}
        {callType === "video" && (
          <button
            type="button"
            onClick={toggleVideo}
            className={`p-2.5 sm:p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md shrink-0 active:scale-95 ${
              isVideoOff
                ? "bg-red-500 text-white scale-105"
                : "bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] text-theme-main border border-[var(--glass-border)]"
            }`}
            title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
          >
            {isVideoOff ? <VideoOff size={17} /> : <Video size={17} />}
          </button>
        )}

        {/* Flip Camera Button (if video call) */}
        {callType === "video" && (
          <button
            type="button"
            onClick={switchCamera}
            className="p-2.5 sm:p-3.5 rounded-full bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] text-theme-main border border-[var(--glass-border)] transition-all cursor-pointer shadow-md shrink-0 active:rotate-180"
            title="Flip Camera (Front/Rear)"
          >
            <SwitchCamera size={17} />
          </button>
        )}

        {/* Screen Share Toggle (Only on supported laptop/desktop browsers) */}
        {canScreenShare && (
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`p-2.5 sm:p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md shrink-0 active:scale-95 hidden sm:flex ${
              isScreenSharing
                ? "bg-emerald-500 text-white scale-105 shadow-emerald-500/30 ring-2 ring-emerald-400/40"
                : "bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] text-theme-main border border-[var(--glass-border)]"
            }`}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Your Screen"}
          >
            {isScreenSharing ? <MonitorOff size={17} /> : <Monitor size={17} />}
          </button>
        )}

        {/* Reaction Launcher */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            className="p-2.5 sm:p-3.5 rounded-full bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] text-theme-main border border-[var(--glass-border)] transition-all cursor-pointer shadow-md active:scale-95"
            title="Send Live Reaction"
          >
            <Sparkles size={17} className="text-amber-400" />
          </button>
          {showReactionPicker && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[var(--glass-heavy)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-full px-3 py-1.5 flex items-center gap-2 shadow-glass animate-scaleIn z-50">
              {["🔥", "⚡", "👏", "🚀", "❤️", "💯"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => triggerReaction(emoji)}
                  className="text-xl hover:scale-125 transition-transform p-1 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Speaker Toggle */}
        <button
          type="button"
          onClick={toggleSpeaker}
          className={`p-2.5 sm:p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md shrink-0 active:scale-95 ${
            isSpeakerOn
              ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30"
              : "bg-[var(--glass-surface)] text-theme-muted border border-[var(--glass-border)] hover:text-theme-main"
          }`}
          title={isSpeakerOn ? "Speaker Active (Click to mute audio)" : "Speaker Muted (Click to unmute)"}
        >
          {isSpeakerOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>

        {/* End Call Button */}
        <button
          type="button"
          onClick={endCall}
          className="p-2.5 sm:p-3.5 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 text-white shadow-lg transition-all duration-200 cursor-pointer ml-1 sm:ml-2 shrink-0"
          title="End Call"
        >
          <PhoneOff size={17} />
        </button>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
};

export default CallModal;
