import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import cookie from "cookie";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL || "http://localhost:5173",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://localhost:5175",
    ],
    credentials: true,
  },
});

// Store user socket mappings for private messaging and online status
const userSocketMap = {}; // { userId: socketId }

export const getReceiverSocketId = (receiverId) => {
  return userSocketMap[receiverId];
};

// Middleware to authenticate socket connections via cookie
io.use((socket, next) => {
  const cookies = socket.handshake.headers.cookie;
  if (!cookies) {
    return next(new Error("Authentication error: No cookies found"));
  }

  const parsedCookies = cookie.parse(cookies);
  const token = parsedCookies.jwt;

  if (!token) {
    return next(new Error("Authentication error: Token missing"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch {
    return next(new Error("Authentication error: Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  const userId = socket.userId;

  if (userId) {
    userSocketMap[userId] = socket.id;
    // Broadcast online status to all users
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  }

  // Room logic
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`User ${userId} joined room ${roomId}`);
  });

  socket.on("leaveRoom", (roomId) => {
    socket.leave(roomId);
    console.log(`User ${userId} left room ${roomId}`);
  });

  // Typing indicators
  socket.on("typing", ({ targetId, targetType, username }) => {
    if (targetType === "room") {
      socket.to(targetId).emit("userTyping", { userId, username, targetId, targetType });
    } else {
      const receiverSocketId = getReceiverSocketId(targetId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("userTyping", { userId, username, targetId: userId, targetType: "user" });
      }
    }
  });

  socket.on("stopTyping", ({ targetId, targetType, username }) => {
    if (targetType === "room") {
      socket.to(targetId).emit("userStoppedTyping", { userId, username, targetId, targetType });
    } else {
      const receiverSocketId = getReceiverSocketId(targetId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("userStoppedTyping", { userId, username, targetId: userId, targetType: "user" });
      }
    }
  });

  // WebRTC Audio/Video Calling Signaling
  socket.on("callUser", ({ userToCall, signalData, callType, callerInfo }) => {
    const receiverSocketId = getReceiverSocketId(userToCall);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("incomingCall", {
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
    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("callAccepted", { signal });
    }
  });

  socket.on("rejectCall", ({ to }) => {
    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("callRejected");
    }
  });

  socket.on("endCall", ({ to }) => {
    const peerSocketId = getReceiverSocketId(to);
    if (peerSocketId) {
      io.to(peerSocketId).emit("callEnded");
    }
  });

  socket.on("iceCandidate", ({ to, candidate }) => {
    const peerSocketId = getReceiverSocketId(to);
    if (peerSocketId) {
      io.to(peerSocketId).emit("iceCandidate", { candidate });
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
    if (userId && userSocketMap[userId] === socket.id) {
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });
});

export { app, io, server };
