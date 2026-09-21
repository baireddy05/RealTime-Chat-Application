import { create } from "zustand";
import { soundManager } from "../lib/sound";
import { notificationManager } from "../lib/notification";
import { useAuthStore } from "./useAuthStore";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ],
  iceCandidatePoolSize: 10,
};

let timerInterval = null;
let pendingIceCandidates = [];

const getAudioConstraints = () => ({
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
});

const getDeviceLayout = () => {
  const isPortrait =
    typeof window !== "undefined" ? window.innerHeight >= window.innerWidth : false;
  const isMobile =
    typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || "");
  return { isPortrait, isMobile };
};

const getVideoConstraints = (facingMode = "user") => {
  // Request portrait capture on portrait phones so a mobile publisher
  // actually sends portrait (9:16) instead of a forced landscape crop.
  // On laptop/desktop (landscape window) keep the HD landscape default.
  const isPortraitWindow =
    typeof window !== "undefined" && window.innerHeight > window.innerWidth;
  if (isPortraitWindow) {
    return {
      facingMode: facingMode ? { ideal: facingMode } : "user",
      width: { ideal: 720, max: 1080 },
      height: { ideal: 1280, max: 1920 },
    };
  }
  return {
    facingMode: facingMode ? { ideal: facingMode } : "user",
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
  };
};

export const useCallStore = create((set, get) => ({
  callState: "idle", // 'idle' | 'calling' | 'incoming' | 'connected'
  callType: "video", // 'audio' | 'video'
  peerUser: null, // { _id, name, username, profilePic }
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isVideoOff: false,
  isPeerMuted: false,
  isPeerVideoOff: false,
  isSpeakerOn: true,
  isScreenSharing: false,
  screenStream: null,
  currentFacingMode: "user", // 'user' | 'environment'
  hasMultipleCameras: false,
  isSwapped: false,
  // Peer's device layout, signaled end-to-end (null = unknown yet)
  peerIsPortrait: null,
  peerIsMobile: false,
  callDuration: 0,
  incomingSignal: null,
  peerConnection: null,
  activeSocket: null,

  // Broadcast our current window orientation to the peer (debounced by caller)
  sendLayoutUpdate: () => {
    const { activeSocket, peerUser, callState } = get();
    if (!activeSocket || !peerUser?._id || (callState !== "calling" && callState !== "connected")) return;
    try {
      const layout = getDeviceLayout();
      activeSocket.emit("peerLayout", { to: peerUser._id, ...layout });
    } catch {}
  },

  checkMultipleCameras: async () => {
    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        set({ hasMultipleCameras: videoInputs.length > 1 });
      }
    } catch (err) {
      console.warn("[PulseCall] Error enumerating media devices:", err);
    }
  },

  toggleSwapVideo: () => {
    set((state) => ({ isSwapped: !state.isSwapped }));
  },

  switchCamera: async () => {
    const { currentFacingMode, localStream, peerConnection, callType } = get();
    if (callType !== "video") return;
    const nextFacing = currentFacingMode === "user" ? "environment" : "user";

    try {
      if (!navigator?.mediaDevices?.getUserMedia) return;
      let newStream = null;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextFacing } },
        });
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing },
        });
      }

      const newVideoTrack = newStream?.getVideoTracks()?.[0];
      if (newVideoTrack) {
        if (localStream) {
          const oldVideoTrack = localStream.getVideoTracks()[0];
          if (oldVideoTrack) {
            oldVideoTrack.stop();
            localStream.removeTrack(oldVideoTrack);
          }
          localStream.addTrack(newVideoTrack);
        }

        if (peerConnection) {
          const senders = peerConnection.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === "video");
          if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
          }
        }

        set({
          currentFacingMode: nextFacing,
          localStream: new MediaStream(localStream ? localStream.getTracks() : [newVideoTrack]),
        });
      }
    } catch (err) {
      console.warn("[PulseCall] Failed to switch camera facingMode:", err);
    }
  },

  // Initialize Socket Listeners for incoming calls and signaling
  initSocketListeners: (socket) => {
    if (!socket || get().activeSocket === socket) return;
    set({ activeSocket: socket });

    socket.off("incomingCall");
    socket.off("callAccepted");
    socket.off("callRejected");
    socket.off("callEnded");
    socket.off("callUnavailable");
    socket.off("iceCandidate");
    socket.off("peerToggleVideo");
    socket.off("peerToggleMute");
    socket.off("peerLayout");

    socket.on("incomingCall", ({ signal, from, callType, callerInfo, deviceInfo }) => {
      // If already in a call, reject the incoming call automatically
      if (get().callState !== "idle") {
        socket.emit("rejectCall", { to: from });
        return;
      }

      pendingIceCandidates = [];
      soundManager.playIncomingRing();
      notificationManager.sendNotification({
        title: `Incoming ${callType === "video" ? "Video" : "Voice"} Call`,
        body: `${callerInfo?.name || callerInfo?.username || "Someone"} is calling you...`,
        onClick: () => window.focus(),
      });

      set({
        callState: "incoming",
        callType: callType || "video",
        peerUser: {
          _id: from,
          name: callerInfo?.name || callerInfo?.username || "Caller",
          username: callerInfo?.username || "Caller",
          profilePic: callerInfo?.profilePic,
        },
        incomingSignal: signal,
        isPeerMuted: false,
        isPeerVideoOff: false,
        // Caller tells us its orientation up-front so the first frame already lays out right
        peerIsPortrait: deviceInfo?.isPortrait ?? callerInfo?.deviceInfo?.isPortrait ?? null,
        peerIsMobile: deviceInfo?.isMobile ?? callerInfo?.deviceInfo?.isMobile ?? false,
      });
    });

    socket.on("callAccepted", async ({ signal, deviceInfo }) => {
      soundManager.stopRinging();
      const pc = get().peerConnection;
      if (pc && signal) {
        try {
          if (pc.signalingState !== "closed") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
            // Process any queued ICE candidates
            while (pendingIceCandidates.length > 0) {
              const candidate = pendingIceCandidates.shift();
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (e) {
                console.warn("[PulseCall] Error adding queued ICE candidate:", e);
              }
            }
          }
        } catch (err) {
          console.error("[PulseCall] Error setting remote description on caller:", err);
        }
      }

      // Start call duration counter
      if (timerInterval) clearInterval(timerInterval);
      set({
        callState: "connected",
        callDuration: 0,
        ...(deviceInfo ? { peerIsPortrait: deviceInfo.isPortrait ?? null, peerIsMobile: !!deviceInfo.isMobile } : {}),
      });
      timerInterval = setInterval(() => {
        set((state) => ({ callDuration: state.callDuration + 1 }));
      }, 1000);
    });

    socket.on("callRejected", () => {
      soundManager.stopRinging();
      soundManager.playCallEndSound();
      get().cleanupCall();
    });

    socket.on("callEnded", () => {
      soundManager.stopRinging();
      soundManager.playCallEndSound();
      get().cleanupCall();
    });

    socket.on("callUnavailable", ({ message }) => {
      soundManager.stopRinging();
      soundManager.playCallEndSound();
      alert(message || "User is currently offline or unavailable.");
      get().cleanupCall();
    });

    socket.on("iceCandidate", async ({ candidate }) => {
      if (!candidate) return;
      const pc = get().peerConnection;
      if (pc && pc.remoteDescription && pc.remoteDescription.type && pc.signalingState !== "closed") {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn("[PulseCall] Error adding ICE candidate:", err);
        }
      } else {
        pendingIceCandidates.push(candidate);
      }
    });

    socket.on("peerToggleVideo", ({ isVideoOff }) => {
      set({ isPeerVideoOff: !!isVideoOff });
    });

    socket.on("peerToggleMute", ({ isMuted }) => {
      set({ isPeerMuted: !!isMuted });
    });

    socket.on("peerLayout", ({ isPortrait, isMobile }) => {
      set({
        peerIsPortrait: typeof isPortrait === "boolean" ? isPortrait : null,
        peerIsMobile: !!isMobile,
      });
    });
  },

  // Start outgoing call
  startCall: async ({ targetUser, callType = "video" }) => {
    const socket = get().activeSocket;
    if (!socket || !targetUser) return;

    if (!navigator?.mediaDevices?.getUserMedia) {
      alert("Camera and microphone access requires a Secure Context (HTTPS or localhost). If testing on mobile across a local network, please connect via HTTPS or use localhost.");
      return;
    }

    pendingIceCandidates = [];
    soundManager.playOutgoingRing();
    get().checkMultipleCameras();

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: getAudioConstraints(),
        video: callType === "video" ? getVideoConstraints(get().currentFacingMode) : false,
      });
    } catch (err) {
      console.warn("[PulseCall] Could not obtain optimal stream, trying fallback:", err);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video" ? { facingMode: "user" } : false,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          callType = "audio";
        } catch {
          soundManager.stopRinging();
          alert("Camera or Microphone permission was denied or unavailable.");
          return;
        }
      }
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to peer connection
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Handle remote tracks with React state reactivity
    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
            remoteStream.addTrack(track);
          }
        });
      } else if (event.track) {
        if (!remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          remoteStream.addTrack(event.track);
        }
      }

      event.track.onmute = () => set({ remoteStream });
      event.track.onunmute = () => set({ remoteStream });
      event.track.onended = () => set({ remoteStream });

      set({ remoteStream });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("iceCandidate", {
          to: targetUser._id || targetUser.id,
          candidate: event.candidate,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        if (pc.restartIce) pc.restartIce();
      }
    };

    set({
      callState: "calling",
      callType,
      peerUser: {
        _id: targetUser._id || targetUser.id,
        name: targetUser.name || targetUser.username,
        username: targetUser.username,
        profilePic: targetUser.profilePic,
      },
      localStream: stream,
      remoteStream,
      peerConnection: pc,
      isMuted: false,
      isVideoOff: callType !== "video",
      isPeerMuted: false,
      isPeerVideoOff: false,
      callDuration: 0,
    });

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const currentAuthUser = useAuthStore.getState().authUser;
      const deviceInfo = getDeviceLayout();
      socket.emit("callUser", {
        userToCall: targetUser._id || targetUser.id,
        signalData: offer,
        callType,
        deviceInfo,
        callerInfo: {
          _id: currentAuthUser?._id,
          name: currentAuthUser?.username || "Pulse User",
          username: currentAuthUser?.username || "Pulse User",
          profilePic: currentAuthUser?.profilePic || "",
          deviceInfo,
        },
      });
    } catch (error) {
      console.error("[PulseCall] Error creating WebRTC offer:", error);
      get().cleanupCall();
    }
  },

  // Answer incoming call
  answerCall: async () => {
    soundManager.stopRinging();
    const { activeSocket, peerUser, incomingSignal, callType } = get();
    if (!activeSocket || !peerUser || !incomingSignal) return;

    if (!navigator?.mediaDevices?.getUserMedia) {
      alert("Camera and microphone access requires a Secure Context (HTTPS or localhost). If testing on mobile across a local network, please connect via HTTPS or use localhost.");
      get().rejectCall();
      return;
    }

    let stream = null;
    get().checkMultipleCameras();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: getAudioConstraints(),
        video: callType === "video" ? getVideoConstraints(get().currentFacingMode) : false,
      });
    } catch (err) {
      console.warn("[PulseCall] Could not obtain optimal camera on answer, falling back:", err);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video" ? { facingMode: "user" } : false,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch {
          alert("Camera or Microphone permission was denied or unavailable.");
          get().rejectCall();
          return;
        }
      }
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Handle remote tracks with React state reactivity
    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
            remoteStream.addTrack(track);
          }
        });
      } else if (event.track) {
        if (!remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          remoteStream.addTrack(event.track);
        }
      }

      event.track.onmute = () => set({ remoteStream });
      event.track.onunmute = () => set({ remoteStream });
      event.track.onended = () => set({ remoteStream });

      set({ remoteStream });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && activeSocket) {
        activeSocket.emit("iceCandidate", {
          to: peerUser._id,
          candidate: event.candidate,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        if (pc.restartIce) pc.restartIce();
      }
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));

      // Process any early buffered ICE candidates
      while (pendingIceCandidates.length > 0) {
        const candidate = pendingIceCandidates.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("[PulseCall] Error adding buffered candidate on callee:", e);
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      activeSocket.emit("answerCall", {
        to: peerUser._id,
        signal: answer,
        deviceInfo: getDeviceLayout(),
      });

      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        set((state) => ({ callDuration: state.callDuration + 1 }));
      }, 1000);

      set({
        callState: "connected",
        localStream: stream,
        remoteStream,
        peerConnection: pc,
        callDuration: 0,
        isMuted: false,
        isVideoOff: callType !== "video",
        isPeerMuted: false,
        isPeerVideoOff: false,
      });
    } catch (err) {
      console.error("[PulseCall] Error answering WebRTC call:", err);
      get().cleanupCall();
    }
  },

  // Reject incoming call
  rejectCall: () => {
    soundManager.stopRinging();
    const { activeSocket, peerUser } = get();
    if (activeSocket && peerUser) {
      activeSocket.emit("rejectCall", { to: peerUser._id });
    }
    get().cleanupCall();
  },

  // End active or calling call
  endCall: () => {
    soundManager.stopRinging();
    soundManager.playCallEndSound();
    const { activeSocket, peerUser } = get();
    if (activeSocket && peerUser) {
      activeSocket.emit("endCall", { to: peerUser._id });
    }
    get().cleanupCall();
  },

  // Toggle microphone
  toggleMute: () => {
    const { localStream, isMuted, activeSocket, peerUser } = get();
    const nextMuted = !isMuted;
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    set({ isMuted: nextMuted });
    if (activeSocket && peerUser?._id) {
      activeSocket.emit("peerToggleMute", { to: peerUser._id, isMuted: nextMuted });
    }
  },

  // Toggle video camera
  toggleVideo: () => {
    const { localStream, isVideoOff, activeSocket, peerUser, callType } = get();
    if (callType !== "video") return;
    const nextVideoOff = !isVideoOff;
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !nextVideoOff;
      });
    }
    set({ isVideoOff: nextVideoOff });
    if (activeSocket && peerUser?._id) {
      activeSocket.emit("peerToggleVideo", { to: peerUser._id, isVideoOff: nextVideoOff });
    }
  },

  // Toggle speaker
  toggleSpeaker: () => {
    set((state) => ({ isSpeakerOn: !state.isSpeakerOn }));
  },

  // Toggle screen sharing
  toggleScreenShare: async () => {
    const { isScreenSharing, peerConnection } = get();

    if (!isScreenSharing) {
      try {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          alert("Screen sharing is not supported on this device or browser.");
          return;
        }

        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        const screenTrack = displayStream.getVideoTracks()[0];

        if (peerConnection) {
          const senders = peerConnection.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === "video");
          if (videoSender) {
            await videoSender.replaceTrack(screenTrack);
          }
        }

        // When user stops screen sharing via browser's native banner
        screenTrack.onended = () => {
          get().stopScreenShare();
        };

        set({
          isScreenSharing: true,
          screenStream: displayStream,
        });
      } catch (err) {
        if (err.name !== "NotAllowedError") {
          console.error("Error starting screen share:", err);
        }
      }
    } else {
      get().stopScreenShare();
    }
  },

  // Stop screen sharing and restore camera
  stopScreenShare: async () => {
    const { screenStream, localStream, peerConnection } = get();
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }

    if (peerConnection && localStream) {
      const cameraTrack = localStream.getVideoTracks()[0];
      const senders = peerConnection.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === "video");
      if (videoSender && cameraTrack) {
        await videoSender.replaceTrack(cameraTrack);
      }
    }

    set({
      isScreenSharing: false,
      screenStream: null,
    });
  },

  // Clean up all resources
  cleanupCall: () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    pendingIceCandidates = [];

    const { localStream, screenStream, peerConnection } = get();
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnection) {
      try {
        peerConnection.close();
      } catch {}
    }

    set({
      callState: "idle",
      peerUser: null,
      localStream: null,
      remoteStream: null,
      screenStream: null,
      peerConnection: null,
      incomingSignal: null,
      callDuration: 0,
      isMuted: false,
      isVideoOff: false,
      isPeerMuted: false,
      isPeerVideoOff: false,
      isScreenSharing: false,
      currentFacingMode: "user",
      isSwapped: false,
    });
    // Refresh history in the background so the log stays current
    try {
      get().getCallHistory?.().catch(() => {});
    } catch {}
  },

  // ---- Call history ----
  callHistory: [],
  isCallHistoryLoading: false,

  getCallHistory: async () => {
    set({ isCallHistoryLoading: true });
    try {
      const { axiosInstance } = await import("../lib/axios");
      const res = await axiosInstance.get("/calls?limit=50");
      set({ callHistory: res.data || [] });
      return res.data;
    } catch (error) {
      console.error("[PulseCall] Error fetching call history:", error);
      return [];
    } finally {
      set({ isCallHistoryLoading: false });
    }
  },

  clearCallHistory: async () => {
    try {
      const { axiosInstance } = await import("../lib/axios");
      await axiosInstance.delete("/calls");
      set({ callHistory: [] });
      return { success: true };
    } catch (error) {
      console.error("[PulseCall] Error clearing call history:", error);
      return { success: false };
    }
  },
}));
