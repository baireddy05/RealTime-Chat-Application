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
};

let timerInterval = null;
let pendingIceCandidates = [];

export const useCallStore = create((set, get) => ({
  callState: "idle", // 'idle' | 'calling' | 'incoming' | 'connected'
  callType: "video", // 'audio' | 'video'
  peerUser: null, // { _id, name, username, profilePic }
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isVideoOff: false,
  isSpeakerOn: true,
  isScreenSharing: false,
  screenStream: null,
  callDuration: 0,
  incomingSignal: null,
  peerConnection: null,
  activeSocket: null,

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

    socket.on("incomingCall", ({ signal, from, callType, callerInfo }) => {
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
      });
    });

    socket.on("callAccepted", async ({ signal }) => {
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
      set({ callState: "connected", callDuration: 0 });
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
  },

  // Start outgoing call
  startCall: async ({ targetUser, callType = "video" }) => {
    const socket = get().activeSocket;
    if (!socket || !targetUser) return;

    pendingIceCandidates = [];
    soundManager.playOutgoingRing();

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
      });
    } catch (err) {
      console.warn("[PulseCall] Could not obtain video stream, falling back to audio:", err);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        callType = "audio";
      } catch {
        soundManager.stopRinging();
        alert("Camera or Microphone permission was denied or unavailable.");
        return;
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
      set({ remoteStream: new MediaStream(remoteStream.getTracks()) });
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
      callDuration: 0,
    });

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const currentAuthUser = useAuthStore.getState().authUser;
      socket.emit("callUser", {
        userToCall: targetUser._id || targetUser.id,
        signalData: offer,
        callType,
        callerInfo: {
          _id: currentAuthUser?._id,
          name: currentAuthUser?.username || "Pulse User",
          username: currentAuthUser?.username || "Pulse User",
          profilePic: currentAuthUser?.profilePic || "",
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

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
      });
    } catch (err) {
      console.warn("[PulseCall] Could not obtain camera on answer, falling back to audio:", err);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch {
        alert("Camera or Microphone permission was denied or unavailable.");
        get().rejectCall();
        return;
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
      set({ remoteStream: new MediaStream(remoteStream.getTracks()) });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && activeSocket) {
        activeSocket.emit("iceCandidate", {
          to: peerUser._id,
          candidate: event.candidate,
        });
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
    const { localStream, isMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // Inverting current state
      });
      set({ isMuted: !isMuted });
    }
  },

  // Toggle video camera
  toggleVideo: () => {
    const { localStream, isVideoOff } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff; // Inverting current state
      });
      set({ isVideoOff: !isVideoOff });
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
      isScreenSharing: false,
    });
  },
}));
