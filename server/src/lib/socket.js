import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import Room from "../models/Room.model.js";
import Message from "../models/Message.model.js";
import { isOriginAllowed } from "./corsConfig.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Socket CORS origin not allowed: ${origin}`));
      }
    },
    credentials: true,
  },
});

// Store user socket mappings for multi-device support, private messaging, and online status
const userSocketMap = {}; // { userId: Set<socketId> }
// Per-socket last-forwarded timestamps to throttle typing fan-out.
// Clients can emit `typing` on every keystroke; without throttling a fast
// typist fans out dozens of broadcasts/sec to every room member.
const lastTypingForwardedAt = new Map(); // `${userId}:${targetId}` -> epoch ms
const TYPING_THROTTLE_MS = 900;
const hiddenUsers = new Set(); // { userId }
const groupCalls = {}; // { roomId: Set<userId> }

export const getReceiverSocketId = (receiverId) => {
  if (!receiverId) return undefined;
  const id = receiverId._id ? receiverId._id.toString() : receiverId.toString();
  const sockets = userSocketMap[id];
  if (!sockets || sockets.size === 0) return undefined;
  return Array.from(sockets)[sockets.size - 1]; // most recently active socket
};

export const getUserSocketIds = (receiverId) => {
  if (!receiverId) return [];
  const id = receiverId._id ? receiverId._id.toString() : receiverId.toString();
  const sockets = userSocketMap[id];
  return sockets ? Array.from(sockets) : [];
};

// Middleware to authenticate socket connections via cookie OR auth payload
io.use((socket, next) => {
  let token;
  const cookies = socket.handshake.headers.cookie;
  if (cookies) {
    const parsedCookies = cookie.parse(cookies);
    token = parsedCookies.jwt;
  }

  // Fallback to socket handshake auth token (crucial for cross-domain cookie restrictions)
  if (!token && socket.handshake.auth?.token) {
    token = socket.handshake.auth.token;
  }

  if (!token) {
    return next(new Error("Authentication error: Token missing"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId?.toString();
    next();
  } catch {
    return next(new Error("Authentication error: Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  const userId = socket.userId?.toString();

  if (userId) {
    if (!userSocketMap[userId]) {
      userSocketMap[userId] = new Set();
    }
    userSocketMap[userId].add(socket.id);
    // Every socket joins the user's personal room so io.to(userId) reaches all their devices/tabs
    socket.join(userId);

    // Broadcast online status to all users
    const getVisibleUsers = () => Object.keys(userSocketMap).filter(id => !hiddenUsers.has(id));
    io.emit("getOnlineUsers", getVisibleUsers());

    // Auto-join user to all their rooms so they receive group messages in real-time
    Room.find({ members: userId })
      .select("_id")
      .lean()
      .then((userRooms) => {
        (userRooms || []).forEach((r) => socket.join(r._id.toString()));
      })
      .catch((err) => {
        console.error("Error auto-joining user rooms on socket connect:", err.message);
      });
  }

  // Room logic
  socket.on("joinRoom", async (roomId) => {
    try {
      if (!roomId || !userId) return;
      const room = await Room.findById(roomId).select("members").lean();
      if (!room) return;
      const isMember = (room.members || []).some(
        (m) => m.toString() === userId.toString()
      );
      // Do NOT auto-add non-members — joining is allowed only for members.
      // This prevents privilege escalation by guessing room ids.
      if (!isMember) return;
      socket.join(roomId.toString());
      console.log(`User ${userId} joined room ${roomId}`);
    } catch (err) {
      console.error("Error in socket joinRoom:", err.message);
    }
  });

  socket.on("leaveRoom", (roomId) => {
    socket.leave(roomId);
    console.log(`User ${userId} left room ${roomId}`);
  });

  // Typing indicators (throttled server-side: at most 1 forward per target per 900ms)
  socket.on("typing", ({ targetId, targetType, username }) => {
    if (!targetId) return;
    try {
      const key = `${userId}:${targetId}`;
      const now = Date.now();
      if (now - (lastTypingForwardedAt.get(key) || 0) < TYPING_THROTTLE_MS) return;
      lastTypingForwardedAt.set(key, now);
      if (targetType === "room") {
        socket.to(targetId.toString()).emit("userTyping", { userId, username, targetId, targetType });
      } else {
        io.to(targetId.toString()).emit("userTyping", { userId, username, targetId: userId, targetType: "user" });
      }
    } catch {}
  });

  socket.on("stopTyping", ({ targetId, targetType, username }) => {
    if (!targetId) return;
    try {
      if (targetType === "room") {
        socket.to(targetId.toString()).emit("userStoppedTyping", { userId, username, targetId, targetType });
      } else {
        io.to(targetId.toString()).emit("userStoppedTyping", { userId, username, targetId: userId, targetType: "user" });
      }
    } catch {}
  });

  // WebRTC Audio/Video Calling Signaling
  socket.on("callUser", ({ userToCall, signalData, callType, callerInfo, deviceInfo }) => {
    if (!userToCall) return;
    const targetSockets = userSocketMap[userToCall.toString()];
    if (targetSockets && targetSockets.size > 0) {
      io.to(userToCall.toString()).emit("incomingCall", {
        signal: signalData,
        from: userId,
        callType: callType || "video",
        callerInfo: callerInfo || { _id: userId },
        deviceInfo: deviceInfo || callerInfo?.deviceInfo || null,
      });
    } else {
      socket.emit("callUnavailable", { message: "User is currently offline" });
    }
  });

  socket.on("answerCall", ({ to, signal, deviceInfo }) => {
    if (!to) return;
    io.to(to.toString()).emit("callAccepted", { signal, deviceInfo });
  });

  socket.on("rejectCall", ({ to }) => {
    if (!to) return;
    io.to(to.toString()).emit("callRejected");
  });

  socket.on("endCall", ({ to }) => {
    if (!to) return;
    io.to(to.toString()).emit("callEnded");
  });

  socket.on("iceCandidate", ({ to, candidate }) => {
    if (!to) return;
    io.to(to.toString()).emit("iceCandidate", { candidate });
  });

  socket.on("peerToggleVideo", ({ to, isVideoOff }) => {
    if (!to) return;
    io.to(to.toString()).emit("peerToggleVideo", { isVideoOff });
  });

  socket.on("peerToggleMute", ({ to, isMuted }) => {
    if (!to) return;
    io.to(to.toString()).emit("peerToggleMute", { isMuted });
  });

  // Live device-orientation sync so a portrait phone stays portrait on the laptop
  socket.on("peerLayout", ({ to, isPortrait, isMobile }) => {
    if (!to) return;
    io.to(to.toString()).emit("peerLayout", { isPortrait, isMobile });
  });

  // Mesh Network Group Calls
  socket.on("joinGroupCall", ({ roomId }) => {
    if (!roomId) return;
    if (!groupCalls[roomId]) {
      groupCalls[roomId] = new Set();
    }
    const currentUsersInCall = Array.from(groupCalls[roomId]);
    groupCalls[roomId].add(userId);
    socket.join(`call_${roomId}`);
    
    // Send existing users in the call to the newly joined user so they can initiate peer connections
    socket.emit("allUsersInCall", { users: currentUsersInCall });
    
    // Broadcast to other users in the room that someone started/joined a call
    socket.to(roomId).emit("groupCallStarted", { roomId, startedBy: userId });
  });

  socket.on("signalGroupUser", ({ userToSignal, signal }) => {
    // Send a WebRTC signal to a specific user in the group call with authenticated userId as callerId
    io.to(userToSignal.toString()).emit("userJoinedGroupCall", { signal, callerId: userId });
  });

  socket.on("returnGroupSignal", ({ callerId, signal }) => {
    // Return a WebRTC signal back to the initiator with authenticated userId as id
    io.to(callerId.toString()).emit("receivingReturnedGroupSignal", { signal, id: userId });
  });

  socket.on("leaveGroupCall", ({ roomId }) => {
    if (!roomId || !groupCalls[roomId]) return;
    groupCalls[roomId].delete(userId);
    socket.leave(`call_${roomId}`);
    io.to(`call_${roomId}`).emit("userLeftGroupCall", { userId });
    
    if (groupCalls[roomId].size === 0) {
      delete groupCalls[roomId];
      io.to(roomId).emit("groupCallEnded", { roomId });
    }
  });

  // Message Delivery Receipt
  socket.on("messageDelivered", async ({ messageId, senderId }) => {
    try {
      if (!messageId || !userId) return;
      await Message.findOneAndUpdate(
        { _id: messageId, "deliveries.userId": { $ne: userId } },
        { $push: { deliveries: { userId, at: new Date() } } }
      ).exec();
      if (!senderId) return;
      io.to(senderId.toString()).emit("messageDelivered", { 
        messageId, 
        delivererId: userId,
        chatId: userId,
        type: "user" 
      });
    } catch (err) {
      console.error("Error in messageDelivered event:", err);
    }
  });

  socket.on("userVisibilityChange", ({ isHidden }) => {
    console.log(`Visibility changed for ${userId}: hidden = ${isHidden}`);
    if (isHidden) {
      hiddenUsers.add(userId);
    } else {
      hiddenUsers.delete(userId);
    }
    const getVisibleUsers = () => Object.keys(userSocketMap).filter(id => !hiddenUsers.has(id));
    io.emit("getOnlineUsers", getVisibleUsers());
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
    if (userId) {
      for (const key of lastTypingForwardedAt.keys()) {
        if (key.startsWith(`${userId}:`)) lastTypingForwardedAt.delete(key);
      }
    }
    if (userId && userSocketMap[userId]) {
      userSocketMap[userId].delete(socket.id);
      if (userSocketMap[userId].size === 0) {
        delete userSocketMap[userId];
        hiddenUsers.delete(userId);
      }
      const getVisibleUsers = () => Object.keys(userSocketMap).filter(id => !hiddenUsers.has(id));
      io.emit("getOnlineUsers", getVisibleUsers());

      // Clean up group calls
      for (const roomId in groupCalls) {
        if (groupCalls[roomId].has(userId)) {
          groupCalls[roomId].delete(userId);
          io.to(`call_${roomId}`).emit("userLeftGroupCall", { userId });
          if (groupCalls[roomId].size === 0) {
            delete groupCalls[roomId];
            io.to(roomId).emit("groupCallEnded", { roomId });
          }
        }
      }
    }
  });
});

export { app, io, server };
