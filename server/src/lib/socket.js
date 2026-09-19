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
const hiddenUsers = new Set(); // { userId }

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

  // Typing indicators
  socket.on("typing", ({ targetId, targetType, username }) => {
    if (!targetId) return;
    try {
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
  socket.on("callUser", ({ userToCall, signalData, callType, callerInfo }) => {
    if (!userToCall) return;
    const targetSockets = userSocketMap[userToCall.toString()];
    if (targetSockets && targetSockets.size > 0) {
      io.to(userToCall.toString()).emit("incomingCall", {
        signal: signalData,
        from: userId,
        callType: callType || "video",
        callerInfo: callerInfo || { _id: userId },
      });
    } else {
      socket.emit("callUnavailable", { message: "User is currently offline" });
    }
  });

  socket.on("answerCall", ({ to, signal }) => {
    if (!to) return;
    io.to(to.toString()).emit("callAccepted", { signal });
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
    if (userId && userSocketMap[userId]) {
      userSocketMap[userId].delete(socket.id);
      if (userSocketMap[userId].size === 0) {
        delete userSocketMap[userId];
        hiddenUsers.delete(userId);
      }
      const getVisibleUsers = () => Object.keys(userSocketMap).filter(id => !hiddenUsers.has(id));
      io.emit("getOnlineUsers", getVisibleUsers());
    }
  });
});

export { app, io, server };
