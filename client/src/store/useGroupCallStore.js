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
    if (!socket || get().activeSocket === socket) return;
    set({ activeSocket: socket });

    socket.off("allUsersInCall");
    socket.off("userJoinedGroupCall");
    socket.off("receivingReturnedGroupSignal");
    socket.off("userLeftGroupCall");

    // We joined the room; now initiate connections with everyone already in the room
    socket.on("allUsersInCall", ({ users }) => {
      const { localStream } = get();
      if (!localStream) return;
      users.forEach(userId => {
        const peer = get().createPeer(userId, true, localStream);
        set(state => ({ peers: { ...state.peers, [userId]: peer } }));
      });
    });

    // Someone else joined the room; they sent us an offer or ICE candidate
    socket.on("userJoinedGroupCall", async ({ signal, callerId }) => {
      const { localStream, activeSocket } = get();
      if (!localStream) return;
      let peer = get().peers[callerId];
      if (!peer) {
        peer = get().createPeer(callerId, false, localStream);
        set(state => ({ peers: { ...state.peers, [callerId]: peer } }));
      }
      
      try {
        if (signal?.candidate) {
          await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else if (signal?.sdp || signal?.type) {
          await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp || signal));
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
            await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
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
        peers[userId].close();
      }
      const newPeers = { ...peers };
      delete newPeers[userId];
      
      const newStreams = { ...remoteStreams };
      delete newStreams[userId];
      
      set({ peers: newPeers, remoteStreams: newStreams });
    });
  },

  createPeer: (userToSignal, isInitiator, stream) => {
    const { activeSocket } = get();
    const peer = new RTCPeerConnection(ICE_SERVERS);
    
    stream.getTracks().forEach(track => {
      peer.addTrack(track, stream);
    });

    peer.ontrack = (e) => {
      const newStream = e.streams[0];
      set(state => ({
        remoteStreams: { ...state.remoteStreams, [userToSignal]: newStream }
      }));
    };

    peer.onicecandidate = (event) => {
      if (event.candidate && activeSocket) {
        activeSocket.emit("signalGroupUser", {
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
          activeSocket.emit("signalGroupUser", {
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
      alert("Microphone/Camera permission required for group calls.");
      console.error(err);
    }
  },

  leaveGroupCall: () => {
    const { activeSocket, roomId, localStream, peers } = get();
    if (activeSocket && roomId) {
      activeSocket.emit("leaveGroupCall", { roomId });
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    Object.values(peers).forEach(peer => peer.close());

    set({
      groupCallState: "idle",
      roomId: null,
      localStream: null,
      peers: {},
      remoteStreams: {}
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
