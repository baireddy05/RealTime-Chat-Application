import Message from "../models/Message.model.js";
import { getReceiverSocketId, io } from "./socket.js";

export const startMessageScheduler = () => {
  setInterval(async () => {
    try {
      const now = new Date();

      // 1. Dispatch scheduled messages that have reached their scheduled time
      const readyMessages = await Message.find({
        isScheduled: true,
        scheduledFor: { $lte: now },
      }).populate("senderId", "username profilePic");

      for (const msg of readyMessages) {
        msg.isScheduled = false;
        msg.createdAt = now;
        await msg.save();

        if (msg.roomId) {
          io.to(msg.roomId.toString()).emit("newMessage", msg);
        } else {
          const receiverIdStr = (msg.receiverId?._id || msg.receiverId)?.toString();
          const senderIdStr = (msg.senderId?._id || msg.senderId)?.toString();
          if (receiverIdStr) io.to(receiverIdStr).emit("newMessage", msg);
          if (senderIdStr) io.to(senderIdStr).emit("newMessage", msg);
        }
      }

      // 2. Process self-destructing messages that have passed their expiresAt timestamp
      const expiredMessages = await Message.find({
        expiresAt: { $ne: null, $lte: now },
        isDeleted: false,
      });

      for (const msg of expiredMessages) {
        msg.isDeleted = true;
        msg.text = "This message has expired and self-destructed";
        await msg.save();

        const payload = {
          messageId: msg._id,
          roomId: msg.roomId,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          isExpired: true,
        };

        if (msg.roomId) {
          io.to(msg.roomId.toString()).emit("messageExpired", payload);
        } else {
          const receiverIdStr = (msg.receiverId?._id || msg.receiverId)?.toString();
          const senderIdStr = (msg.senderId?._id || msg.senderId)?.toString();
          if (receiverIdStr) io.to(receiverIdStr).emit("messageExpired", payload);
          if (senderIdStr) io.to(senderIdStr).emit("messageExpired", payload);
        }
      }
    } catch (error) {
      console.error("Error in messageScheduler:", error.message);
    }
  }, 3000);
};
