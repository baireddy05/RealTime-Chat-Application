import { useEffect, useRef } from "react";
import { useGroupCallStore } from "../store/useGroupCallStore";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

export default function GroupCallModal() {
  const {
    groupCallState,
    localStream,
    remoteStreams,
    isMuted,
    isVideoOff,
    toggleMute,
    toggleVideo,
    leaveGroupCall
  } = useGroupCallStore();

  if (groupCallState === "idle") return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-md">
      <div className="flex-1 p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-center justify-center overflow-auto relative">
        {/* Local Stream */}
        <div className="relative aspect-video bg-zinc-900 rounded-2xl overflow-hidden shadow-lg border border-white/10 group">
          <VideoPlayer stream={localStream} muted />
          <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded-md text-xs font-semibold text-white backdrop-blur-sm">
            You {isMuted ? "(Muted)" : ""}
          </div>
        </div>

        {/* Remote Streams */}
        {Object.entries(remoteStreams).map(([userId, stream]) => (
          <div key={userId} className="relative aspect-video bg-zinc-900 rounded-2xl overflow-hidden shadow-lg border border-white/10">
            <VideoPlayer stream={stream} />
            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded-md text-xs font-semibold text-white backdrop-blur-sm">
              Participant {userId.substring(0, 4)}
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="h-24 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-6 pb-4">
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full transition-all ${
            isMuted ? "bg-red-500 hover:bg-red-600 text-white" : "bg-white/10 hover:bg-white/20 text-white"
          }`}
        >
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        <button
          onClick={toggleVideo}
          className={`p-4 rounded-full transition-all ${
            isVideoOff ? "bg-red-500 hover:bg-red-600 text-white" : "bg-white/10 hover:bg-white/20 text-white"
          }`}
        >
          {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
        </button>

        <button
          onClick={leaveGroupCall}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all transform hover:scale-105"
        >
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}

function VideoPlayer({ stream, muted = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream) {
      if (el.srcObject !== stream) el.srcObject = stream;
      el.play?.().catch(() => {});
    } else if (el.srcObject) {
      try {
        el.srcObject = null;
      } catch {}
    }
    return () => {
      try {
        if (el) el.srcObject = null;
      } catch {}
    };
  }, [stream]);

  if (!stream) {
    return <div className="w-full h-full flex items-center justify-center text-white/50">Connecting...</div>;
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className="w-full h-full object-cover"
      onClick={(e) => e.currentTarget.play?.().catch(() => {})}
    />
  );
}
