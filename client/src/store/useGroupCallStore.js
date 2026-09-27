import { create } from "zustand";
import { soundManager } from "../lib/sound";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export const useGroupCallStore = create((set, get) => ({
  groupCallState: "idle", // 'idle' | 'connected'
  roomId: null,
  localStream: null,
  peers: {}, // { [userId]: RTCPeerConnection }
  remoteStreams: {}, // { [userId]: MediaStream }
  activeSocket: null,
  isMuted: false,
  isVideoOff: false,

  initSocketListeners: (socket) => {
    if (!socket) return;
    const prev = get().activeSocket;
    if (prev && prev !== socket) {
      try {
        prev.off("allUsersInCall");
        prev.off("userJoinedGroupCall");
        prev.off("receivingReturnedGroupSignal");
        prev.off("userLeftGroupCall");
      } catch {}
    }
    if (prev === socket) return;
    set({ activeSocket: socket });

    socket.off("allUsersInCall");
    socket.off("userJoinedGroupCall");
    socket.off("receivingReturnedGroupSignal");
    socket.off("userLeftGroupCall");

    // Pending ICE queue per peer (candidate may arrive before remote description).
    const iceQueue = get()._iceQueue || {};
    set({ _iceQueue: iceQueue });

    // We joined the room; now initiate connections with everyone already in the room
    socket.on("allUsersInCall", ({ users }) => {
      const { localStream } = get();
      if (!localStream) return;
      (users || []).forEach(userId => {
        if (get().peers[userId]) return;
        try {
          const peer = get().createPeer(userId, true, localStream);
          set(state => ({ peers: { ...state.peers, [userId]: peer } }));
        } catch {}
      });
    });

    // Someone else joined the room; they sent us an offer or ICE candidate
    socket.on("userJoinedGroupCall", async ({ signal, callerId }) => {
      const { localStream, activeSocket } = get();
      if (!localStream || !callerId) return;
      let peer = get().peers[callerId];
      if (!peer) {
        try {
          peer = get().createPeer(callerId, false, localStream);
        } catch {
          return;
        }
        set(state => ({ peers: { ...state.peers, [callerId]: peer } }));
      }
      
      try {
        if (signal?.candidate) {
          if (!peer.remoteDescription) {
            const q = get()._iceQueue || {};
            (q[callerId] = q[callerId] || []).push(new RTCIceCandidate(signal.candidate));
            set({ _iceQueue: q });
          } else {
            await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
        } else if (signal?.sdp || signal?.type) {
          await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp || signal));
          // Flush queued candidates after remote description.
          try {
            const q = get()._iceQueue || {};
            const pending = q[callerId] || [];
            if (pending.length) {
              delete q[callerId];
              set({ _iceQueue: q });
              for (const c of pending) {
                try {
                  await peer.addIceCandidate(c);
                } catch {}
              }
            }
          } catch {}
          if (signal.type === "offer" || signal.sdp?.type === "offer") {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            activeSocket.emit("returnGroupSignal", { signal: answer, callerId });
          }
        }
      } catch (err) {
        console.error("Error handling incoming group call signal:", err);
      }
    });

    // We received an answer to our offer or ICE candidate
    socket.on("receivingReturnedGroupSignal", async ({ signal, id }) => {
      const { peers } = get();
      const peer = peers[id];
      if (peer) {
        try {
          if (signal?.candidate) {
            if (!peer.remoteDescription) {
              const q = get()._iceQueue || {};
              (q[id] = q[id] || []).push(new RTCIceCandidate(signal.candidate));
              set({ _iceQueue: q });
            } else {
              await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
          } else if (signal?.sdp || signal?.type) {
            await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp || signal));
          }
        } catch (err) {
          console.error("Error setting remote description for returning signal:", err);
        }
      }
    });

    // User left
    socket.on("userLeftGroupCall", ({ userId }) => {
      const { peers, remoteStreams } = get();
      if (peers[userId]) {
        try {
          peers[userId].ontrack = null;
          peers[userId].onicecandidate = null;
          peers[userId].onnegotiationneeded = null;
          peers[userId].close();
        } catch {}
      }
      try {
        remoteStreams[userId]?.getTracks()?.forEach((t) => t.stop());
      } catch {}
      const newPeers = { ...peers };
      delete newPeers[userId];
      
      const newStreams = { ...remoteStreams };
      delete newStreams[userId];
      
      set({ peers: newPeers, remoteStreams: newStreams });
    });
  },

  createPeer: (userToSignal, isInitiator, stream) => {
    if (!stream) throw new Error("No local stream");
    const peer = new RTCPeerConnection(ICE_SERVERS);
    
    try {
      stream.getTracks().forEach(track => {
        peer.addTrack(track, stream);
      });
    } catch {}

    peer.ontrack = (e) => {
      const newStream = e.streams[0];
      set(state => {
        const prev = state.remoteStreams[userToSignal];
        // Stop replaced tracks to avoid decoder leak on renegotiation.
        try {
          if (prev && prev !== newStream) prev.getTracks().forEach((t) => t.stop());
        } catch {}
        return {
          remoteStreams: { ...state.remoteStreams, [userToSignal]: newStream }
        };
      });
      // Flush queued ICE candidates now that remote description may exist.
      try {
        const q = get()._iceQueue?.[userToSignal] || [];
        if (q.length) {
          q.splice(0).forEach((c) => peer.addIceCandidate(c).catch(() => {}));
        }
      } catch {}
    };

    peer.onicecandidate = (event) => {
      // Read the socket at emit time: a rotation after peer creation must
      // not send signals down the dead socket.
      const sock = get().activeSocket;
      if (event.candidate && sock) {
        sock.emit("signalGroupUser", {
          userToSignal,
          signal: { candidate: event.candidate }
        });
      }
    };

    if (isInitiator) {
      peer.onnegotiationneeded = async () => {
        try {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          get().activeSocket?.emit("signalGroupUser", {
            userToSignal,
            signal: offer
          });
        } catch (err) {
          console.error("Error creating offer:", err);
        }
      };
    }

    return peer;
  },

  joinGroupCall: async (roomId) => {
    // Double-join guard: re-entering without leaving used to orphan the
    // previous mic/camera stream and its peers.
    const cur = get();
    if (cur.groupCallState === "connected" && cur.roomId?.toString() === roomId?.toString()) return;
    if (cur.localStream) {
      try {
        cur.localStream.getTracks().forEach((t) => t.stop());
      } catch {}
    }
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      soundManager.initContext();
      set({ 
        localStream: stream, 
        roomId, 
        groupCallState: "connected",
        isMuted: false,
        isVideoOff: false
      });
      const { activeSocket } = get();
      if (activeSocket) {
        activeSocket.emit("joinGroupCall", { roomId });
      }
    } catch (err) {
      try {
        stream?.getTracks()?.forEach((t) => t.stop());
      } catch {}
      const name = err?.name || "";
      if (name === "NotAllowedError") alert("Microphone/Camera permission denied for group calls.");
      else if (name === "NotFoundError" || name === "OverconstrainedError") alert("No camera/microphone found for group calls.");
      else alert("Microphone/Camera unavailable for group calls.");
      console.error(err);
    }
  },

  leaveGroupCall: () => {
    const { activeSocket, roomId, localStream, peers, remoteStreams } = get();
    if (activeSocket && roomId) {
      try {
        activeSocket.emit("leaveGroupCall", { roomId });
      } catch {}
    }
    
    if (localStream) {
      try {
        localStream.getTracks().forEach(track => track.stop());
      } catch {}
    }
    try {
      Object.values(remoteStreams || {}).forEach((s) => s?.getTracks()?.forEach((t) => t.stop()));
    } catch {}
    
    Object.values(peers).forEach(peer => {
      try {
        peer.ontrack = null;
        peer.onicecandidate = null;
        peer.onnegotiationneeded = null;
        peer.close();
      } catch {}
    });

    set({
      groupCallState: "idle",
      roomId: null,
      localStream: null,
      peers: {},
      remoteStreams: {},
      isMuted: false,
      isVideoOff: false,
      _iceQueue: {},
    });
  },

  toggleMute: () => {
    const { localStream, isMuted } = get();
    const nextMuted = !isMuted;
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    set({ isMuted: nextMuted });
  },

  toggleVideo: () => {
    const { localStream, isVideoOff } = get();
    const nextVideoOff = !isVideoOff;
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !nextVideoOff;
      });
    }
    set({ isVideoOff: nextVideoOff });
  }
}));
