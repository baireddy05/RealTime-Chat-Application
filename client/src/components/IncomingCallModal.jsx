import { useCallStore } from "../store/useCallStore";
import { useBackHandler } from "../lib/backNavigation";
import { soundManager } from "../lib/sound";
import { Phone, PhoneOff, Video } from "lucide-react";

const IncomingCallModal = () => {
  const { callState, callType, peerUser, answerCall, rejectCall } = useCallStore();

  // Intercept physical back button on mobile to decline incoming call
  useBackHandler(callState === "incoming", rejectCall, "incoming_call_modal");

  if (callState !== "incoming" || !peerUser) {
    return null;
  }

  const handleAccept = () => {
    // Resume audio context if browser suspended it before call start
    soundManager.initContext();
    answerCall();
  };

  const handleReject = () => {
    rejectCall();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none"
      onClick={handleReject}
    >
      <div 
        className="w-full max-w-sm glass-panel border border-[var(--glass-border)] rounded-3xl p-6 shadow-glass flex flex-col items-center text-center animate-scaleIn relative overflow-hidden bg-[var(--glass-heavy)] backdrop-blur-3xl text-theme-main"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient background glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-accent-primary/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-emerald-500/20 blur-2xl pointer-events-none" />

        {/* Pulsing Avatar */}
        <div className="relative my-4">
          <div className="w-24 h-24 rounded-full border-2 border-[var(--glass-border)] shadow-xl overflow-hidden bg-slate-800 z-10 relative">
            {peerUser?.profilePic ? (
              <img
                src={peerUser.profilePic}
                alt="Caller avatar"
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
          <div className="absolute -inset-3 rounded-full border-2 border-accent-primary animate-ping pointer-events-none opacity-60" />
        </div>

        {/* Caller Info */}
        <h3 className="text-xl font-bold capitalize tracking-tight text-theme-main mb-1">
          {peerUser?.name || peerUser?.username}
        </h3>
        <p className="text-xs text-accent-primary font-medium flex items-center gap-1.5 justify-center mb-6">
          {callType === "video" ? <Video size={14} /> : <Phone size={14} />}
          <span>Incoming {callType === "video" ? "Video" : "Voice"} Call...</span>
        </p>

        {/* Action Buttons */}
        <div className="flex items-center gap-6 w-full justify-center pt-2">
          {/* Reject */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleReject}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 text-white flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer"
              title="Decline"
            >
              <PhoneOff size={22} />
            </button>
            <span className="text-[11px] text-theme-muted font-medium">Decline</span>
          </div>

          {/* Accept */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleAccept}
              className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer animate-pulse"
              title="Accept"
            >
              {callType === "video" ? <Video size={22} /> : <Phone size={22} />}
            </button>
            <span className="text-[11px] text-emerald-400 font-medium">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
