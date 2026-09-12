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
  } catch (error) {
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

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
    if (userId) {
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });
});

export { app, io, server };
