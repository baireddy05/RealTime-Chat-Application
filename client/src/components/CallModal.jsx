import { useEffect, useRef, useState, useCallback } from "react";
import { useCallStore } from "../store/useCallStore";
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
  
  // Aspect ratio mode: 'auto' | 'portrait' | 'landscape'
  const [aspectMode, setAspectMode] = useState("auto");
  const [isLocalStreamPortrait, setIsLocalStreamPortrait] = useState(false);
  const [isWindowPortrait, setIsWindowPortrait] = useState(
    typeof window !== "undefined" ? window.innerHeight > window.innerWidth : false
  );

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
  const hasRemoteVideo = isConnected && callType === "video" && remoteStream && remoteStream.getVideoTracks().length > 0;

  // Track window and stream orientation
  const checkOrientation = useCallback(() => {
    if (typeof window !== "undefined") {
      setIsWindowPortrait(window.innerHeight > window.innerWidth);
    }
    if (localVideoRef.current) {
      const { videoWidth, videoHeight } = localVideoRef.current;
      if (videoWidth && videoHeight) {
        setIsLocalStreamPortrait(videoHeight > videoWidth);
      }
    }
  }, []);

  useEffect(() => {
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, [checkOrientation]);

  // Bind local stream or screen share stream
  useEffect(() => {
    if (localVideoRef.current) {
      const streamToBind = isScreenSharing && screenStream ? screenStream : localStream;
      if (localVideoRef.current.srcObject !== streamToBind) {
        localVideoRef.current.srcObject = streamToBind;
      }
      localVideoRef.current.play?.().catch(() => {});
      checkOrientation();
    }
  }, [localStream, screenStream, isScreenSharing, callState, checkOrientation]);

  // Bind remote stream (both audio and video elements)
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.play?.().catch(() => {});
    }
    if (remoteAudioRef.current && remoteStream) {
      if (remoteAudioRef.current.srcObject !== remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
      remoteAudioRef.current.play?.().catch(() => {});
    }
  }, [remoteStream, callState, isConnected, hasRemoteVideo]);

  if (callState !== "calling" && callState !== "connected") {
    return null;
  }

  // Calculate effective PiP aspect ratio
  const isEffectivePortrait = isScreenSharing
    ? false
    : aspectMode === "portrait"
    ? true
    : aspectMode === "landscape"
    ? false
    : isLocalStreamPortrait || isWindowPortrait;

  const cycleAspectMode = (e) => {
    e.stopPropagation();
    setAspectMode((prev) => {
      if (prev === "auto") return "portrait";
      if (prev === "portrait") return "landscape";
      return "auto";
    });
  };

  return (
    <div className="fixed inset-0 z-50 apple-ambient-bg flex flex-col items-center justify-between p-3 sm:p-4 md:p-8 animate-fadeIn text-theme-main select-none backdrop-blur-3xl overflow-hidden">
      {/* Dynamic Ambient Blur Glows */}
      <div className="fixed -top-32 -left-32 w-[480px] h-[480px] rounded-full blur-spot-1 pointer-events-none z-0 opacity-40 animate-pulse-slow" />
      <div className="fixed -bottom-32 -right-32 w-[520px] h-[520px] rounded-full blur-spot-2 pointer-events-none z-0 opacity-40 animate-pulse-slow" />

      {/* Hidden audio element for WebRTC audio playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Top Header Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10 glass-panel px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border border-[var(--glass-border)] shadow-glass backdrop-blur-2xl">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-accent-primary/15 text-accent-primary">
            {callType === "video" ? <Video size={18} /> : <Sparkles size={18} />}
          </div>
          <div>
            <h3 className="font-semibold text-sm tracking-tight capitalize text-theme-main flex items-center gap-1.5">
              <span>{peerUser?.name || peerUser?.username || "Pulse User"}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary font-medium">
                {callType === "video" ? "HD Video" : "Voice"}
              </span>
            </h3>
            <p className="text-[11px] text-theme-muted">
              {isConnected ? "Connected" : "Calling..."}
            </p>
          </div>
        </div>

        {/* Status / Duration */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-variant font-mono text-[10.5px] text-secondary font-semibold border border-[var(--glass-border)]">
            1080p 60fps
          </span>
          <div className="px-3.5 py-1 rounded-full bg-[var(--glass-surface)] border border-[var(--glass-border)] shadow-sm">
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

      {/* Main View Area */}
      <div className="w-full max-w-4xl flex-1 my-2 sm:my-4 relative rounded-3xl overflow-hidden glass-panel border border-[var(--glass-border)] shadow-glass flex items-center justify-center bg-black/20 backdrop-blur-xl z-10">
        {callType === "video" ? (
          <>
            {/* Primary Main Video (Remote or Swapped Local) */}
            {!isSwapped ? (
              hasRemoteVideo ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover rounded-3xl"
                />
              ) : (
                <div className="flex flex-col items-center gap-5 text-center p-6 animate-fadeIn">
                  <div className="relative">
                    <div className="w-28 sm:w-32 h-28 sm:h-32 rounded-full border-2 border-[var(--glass-border)] shadow-2xl overflow-hidden bg-slate-800 flex items-center justify-center">
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
                    <h2 className="text-xl font-semibold capitalize tracking-tight text-theme-main">
                      {peerUser?.name || peerUser?.username}
                    </h2>
                    <p className="text-xs text-theme-muted mt-1">
                      {isConnected ? "Camera is turned off" : "Waiting for recipient to accept..."}
                    </p>
                  </div>
                </div>
              )
            ) : (
              /* Swapped: Local stream on main canvas */
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={checkOrientation}
                className={`w-full h-full object-cover rounded-3xl ${
                  currentFacingMode === "user" && !isScreenSharing ? "-scale-x-100" : ""
                } ${isVideoOff ? "hidden" : "block"}`}
              />
            )}

            {/* Screen Share Active Badge */}
            {isScreenSharing && (
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium backdrop-blur-md animate-pulse shadow-md">
                <Monitor size={14} />
                <span>You are sharing your screen (1080p)</span>
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

            {/* Picture-in-Picture (PiP) Video Preview (Portrait Optimized) */}
            <div
              onClick={toggleSwapVideo}
              title="Click to swap main view and mini view"
              className={`absolute bottom-3 sm:bottom-4 right-3 sm:right-4 z-20 cursor-pointer overflow-hidden rounded-2xl border-2 border-[var(--glass-border)] shadow-2xl bg-slate-950 backdrop-blur-xl transition-all duration-300 hover:scale-105 group ${
                isEffectivePortrait
                  ? "w-24 xs:w-28 sm:w-32 md:w-36 aspect-[3/4]"
                  : "w-36 sm:w-44 md:w-48 aspect-video"
              }`}
            >
              {!isSwapped ? (
                /* Normal PiP: Local Camera Preview */
                <>
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={checkOrientation}
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
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
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
                {/* Switch Camera Button (Mobile/Multi-Cam) */}
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

                {/* Aspect Ratio Toggle (Portrait / Landscape) */}
                <button
                  type="button"
                  onClick={cycleAspectMode}
                  className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
                  title={`Aspect Ratio: ${aspectMode.toUpperCase()} (Click to toggle)`}
                >
                  {isEffectivePortrait ? <RectangleHorizontal size={13} /> : <Smartphone size={13} />}
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
                {isEffectivePortrait && (
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
              <div className="w-32 h-32 rounded-full border-4 border-[var(--glass-border)] shadow-2xl overflow-hidden bg-slate-800 z-10 relative">
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
              <h2 className="text-2xl font-bold capitalize tracking-tight text-theme-main">
                {peerUser?.name || peerUser?.username}
              </h2>
              <p className="text-xs text-theme-muted mt-1.5 font-medium">
                {isConnected ? (
                  <span className="text-emerald-400 font-mono tracking-wider">
                    {formatCallTime(callDuration)}
                  </span>
                ) : (
                  "Calling..."
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Dock */}
      <div className="z-20 flex items-center gap-2.5 sm:gap-4 bg-[var(--glass-heavy)] backdrop-blur-3xl border border-[var(--glass-border)] px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-full shadow-glass animate-slideUp max-w-[95vw] overflow-x-auto">
        {/* Mute Button */}
        <button
          type="button"
          onClick={toggleMute}
          className={`p-3 sm:p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md shrink-0 ${
            isMuted
              ? "bg-red-500 text-white scale-105"
              : "bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] text-theme-main border border-[var(--glass-border)]"
          }`}
          title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          {isMuted ? <MicOff size={19} /> : <Mic size={19} />}
        </button>

        {/* Video Toggle (if video call) */}
        {callType === "video" && (
          <button
            type="button"
            onClick={toggleVideo}
            className={`p-3 sm:p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md shrink-0 ${
              isVideoOff
                ? "bg-red-500 text-white scale-105"
                : "bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] text-theme-main border border-[var(--glass-border)]"
            }`}
            title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
          >
            {isVideoOff ? <VideoOff size={19} /> : <Video size={19} />}
          </button>
        )}

        {/* Flip Camera Button (if video call) */}
        {callType === "video" && (
          <button
            type="button"
            onClick={switchCamera}
            className="p-3 sm:p-3.5 rounded-full bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] text-theme-main border border-[var(--glass-border)] transition-all cursor-pointer shadow-md shrink-0 active:rotate-180"
            title="Flip Camera (Front/Rear)"
          >
            <SwitchCamera size={19} />
          </button>
        )}

        {/* Screen Share Toggle */}
        <button
          type="button"
          onClick={toggleScreenShare}
          className={`p-3 sm:p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md shrink-0 ${
            isScreenSharing
              ? "bg-emerald-500 text-white scale-105 shadow-emerald-500/30 ring-2 ring-emerald-400/40"
              : "bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] text-theme-main border border-[var(--glass-border)]"
          }`}
          title={isScreenSharing ? "Stop Sharing Screen" : "Share Your Screen"}
        >
          {isScreenSharing ? <MonitorOff size={19} /> : <Monitor size={19} />}
        </button>

        {/* Reaction Launcher */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            className="p-3 sm:p-3.5 rounded-full bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] text-theme-main border border-[var(--glass-border)] transition-all cursor-pointer shadow-md active:scale-95"
            title="Send Live Reaction"
          >
            <Sparkles size={19} className="text-amber-400" />
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
          className={`p-3 sm:p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md shrink-0 ${
            isSpeakerOn
              ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30"
              : "bg-[var(--glass-surface)] text-theme-muted border border-[var(--glass-border)] hover:text-theme-main"
          }`}
          title={isSpeakerOn ? "Speaker Active" : "Speaker Muted"}
        >
          {isSpeakerOn ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>

        {/* End Call Button */}
        <button
          type="button"
          onClick={endCall}
          className="p-3 sm:p-3.5 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 text-white shadow-lg transition-all duration-200 cursor-pointer ml-1 sm:ml-2 shrink-0"
          title="End Call"
        >
          <PhoneOff size={19} />
        </button>
      </div>
    </div>
  );
};

export default CallModal;

