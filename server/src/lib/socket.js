import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import Room from "../models/Room.model.js";
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

// Store user socket mappings for private messaging and online status
const userSocketMap = {}; // { userId: socketId }
const hiddenUsers = new Set(); // { userId }

export const getReceiverSocketId = (receiverId) => {
  if (!receiverId) return undefined;
  const id = receiverId._id ? receiverId._id.toString() : receiverId.toString();
  return userSocketMap[id];
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
    userSocketMap[userId] = socket.id;
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
      if (!isMember) {
        await Room.findByIdAndUpdate(roomId, { $addToSet: { members: userId } });
      }
      socket.join(roomId);
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

  // Message Delivery Receipt
  socket.on("messageDelivered", async ({ messageId, senderId }) => {
    try {
      if (!messageId || !userId) return;
      await import("../models/Message.model.js").then(({ default: Message }) => {
        Message.findOneAndUpdate(
          { _id: messageId, "deliveries.userId": { $ne: userId } },
          { $push: { deliveries: { userId, at: new Date() } } }
        ).exec();
      });
      const senderSocketId = getReceiverSocketId(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageDelivered", { 
          messageId, 
          delivererId: userId,
          chatId: userId,
          type: "user" 
        });
      }
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
    if (userId && userSocketMap[userId] === socket.id) {
      delete userSocketMap[userId];
      hiddenUsers.delete(userId);
      const getVisibleUsers = () => Object.keys(userSocketMap).filter(id => !hiddenUsers.has(id));
      io.emit("getOnlineUsers", getVisibleUsers());
    }
  });
});

export { app, io, server };
