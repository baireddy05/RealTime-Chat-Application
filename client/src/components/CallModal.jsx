import { useEffect, useRef, useState, useCallback } from "react";
import { useCallStore } from "../store/useCallStore";
import { 
  PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, 
  ShieldCheck, Sparkles, Monitor, MonitorOff 
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
    callDuration,
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    toggleScreenShare,
  } = useCallStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [reactions, setReactions] = useState([]);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const triggerReaction = useCallback((emoji = "🔥") => {
    const id = Date.now() + Math.random();
    const left = Math.floor(Math.random() * 60) + 20;
    setReactions((prev) => [...prev, { id, emoji, left }]);
    setShowReactionPicker(false);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 1500);
  }, []);

  // Bind local stream or screen share stream
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = isScreenSharing && screenStream ? screenStream : localStream;
    }
  }, [localStream, screenStream, isScreenSharing, callState]);

  // Bind remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  if (callState !== "calling" && callState !== "connected") {
    return null;
  }

  const isConnected = callState === "connected";
  const hasRemoteVideo = isConnected && callType === "video" && remoteStream && remoteStream.getVideoTracks().length > 0;

  return (
    <div className="fixed inset-0 z-50 apple-ambient-bg flex flex-col items-center justify-between p-4 md:p-8 animate-fadeIn text-theme-main select-none backdrop-blur-3xl overflow-hidden">
      {/* Dynamic Ambient Blur Glows */}
      <div className="fixed -top-32 -left-32 w-[480px] h-[480px] rounded-full blur-spot-1 pointer-events-none z-0 opacity-40 animate-pulse-slow" />
      <div className="fixed -bottom-32 -right-32 w-[520px] h-[520px] rounded-full blur-spot-2 pointer-events-none z-0 opacity-40 animate-pulse-slow" />

      {/* Hidden audio element for WebRTC audio playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Top Header Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10 glass-panel px-5 py-3 rounded-2xl border border-[var(--glass-border)] shadow-glass backdrop-blur-2xl">
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
            <p className="text-[11px] text-theme-muted flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-400" />
              <span>End-to-end encrypted call</span>
            </p>
          </div>
        </div>

        {/* Status / Duration / Encryption Ribbon (Stitch Specification) */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-variant font-mono text-[10.5px] text-secondary font-semibold border border-[var(--glass-border)]">
            1080p 60fps
          </span>
          <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-tertiary-container/30 text-tertiary font-mono text-[10.5px] border border-tertiary/20">
            <ShieldCheck size={12} />
            <span>DTLS-SRTP E2EE</span>
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
      <div className="w-full max-w-4xl flex-1 my-4 relative rounded-3xl overflow-hidden glass-panel border border-[var(--glass-border)] shadow-glass flex items-center justify-center bg-black/20 backdrop-blur-xl z-10">
        {callType === "video" ? (
          <>
            {/* Remote Video Stream */}
            {hasRemoteVideo ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover rounded-3xl"
              />
            ) : (
              <div className="flex flex-col items-center gap-5 text-center p-6 animate-fadeIn">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full border-2 border-[var(--glass-border)] shadow-2xl overflow-hidden bg-slate-800 flex items-center justify-center">
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
            )}

            {/* Screen Share Active Badge */}
            {isScreenSharing && (
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium backdrop-blur-md animate-pulse shadow-md">
                <Monitor size={14} />
                <span>You are sharing your screen (1080p)</span>
              </div>
            )}

            {/* Floating Live Reactions Layer (Stitch Specification) */}
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

            {/* PiP Local Video Preview */}
            <div className="absolute bottom-4 right-4 w-36 sm:w-48 aspect-video rounded-2xl overflow-hidden border-2 border-[var(--glass-border)] shadow-glass bg-slate-900 z-20 transition-all hover:scale-105 group">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 ${
                  isVideoOff ? "hidden" : "block"
                }`}
              />
              {isVideoOff && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-theme-muted text-[11px] gap-1">
                  <VideoOff size={18} />
                  <span>Camera Off</span>
                </div>
              )}
              <span className="absolute bottom-1.5 left-2 text-[10px] font-medium text-white/80 bg-black/50 backdrop-blur-md px-1.5 py-0.5 rounded-md">
                You
              </span>
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
      <div className="z-20 flex items-center gap-4 bg-[var(--glass-heavy)] backdrop-blur-3xl border border-[var(--glass-border)] px-6 py-3.5 rounded-full shadow-glass animate-slideUp">
        {/* Mute Button */}
        <button
          type="button"
          onClick={toggleMute}
          className={`p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md ${
            isMuted
              ? "bg-red-500 text-white scale-105"
              : "bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] text-theme-main border border-[var(--glass-border)]"
          }`}
          title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Video Toggle (if video call) */}
        {callType === "video" && (
          <button
            type="button"
            onClick={toggleVideo}
            className={`p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md ${
              isVideoOff
                ? "bg-red-500 text-white scale-105"
                : "bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] text-theme-main border border-[var(--glass-border)]"
            }`}
            title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
        )}

        {/* Screen Share Toggle */}
        <button
          type="button"
          onClick={toggleScreenShare}
          className={`p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md ${
            isScreenSharing
              ? "bg-emerald-500 text-white scale-105 shadow-emerald-500/30 ring-2 ring-emerald-400/40"
              : "bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] text-theme-main border border-[var(--glass-border)]"
          }`}
          title={isScreenSharing ? "Stop Sharing Screen" : "Share Your Screen"}
        >
          {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
        </button>

        {/* Reaction Launcher (Stitch Specification) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            className="p-3.5 rounded-full bg-[var(--glass-surface)] hover:bg-[var(--glass-hover)] text-theme-main border border-[var(--glass-border)] transition-all cursor-pointer shadow-md active:scale-95"
            title="Send Live Reaction"
          >
            <Sparkles size={20} className="text-amber-400" />
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
          className={`p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md ${
            isSpeakerOn
              ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30"
              : "bg-[var(--glass-surface)] text-theme-muted border border-[var(--glass-border)] hover:text-theme-main"
          }`}
          title={isSpeakerOn ? "Speaker Active" : "Speaker Muted"}
        >
          {isSpeakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>

        {/* End Call Button */}
        <button
          type="button"
          onClick={endCall}
          className="p-3.5 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 text-white shadow-lg transition-all duration-200 cursor-pointer ml-2"
          title="End Call"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
};

export default CallModal;
