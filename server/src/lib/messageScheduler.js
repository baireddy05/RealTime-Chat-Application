import Message from "../models/Message.model.js";
import Reminder from "../models/Reminder.model.js";
import Room from "../models/Room.model.js";
import { getReceiverSocketId, io } from "./socket.js";
import { notifyNewMessage } from "./notify.js";

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
          try {
            const scheduledRoom = await Room.findById(msg.roomId).select("name members").lean();
            if (scheduledRoom) {
              notifyNewMessage({
                message: msg,
                senderName: msg.senderId?.username,
                room: { _id: msg.roomId, name: scheduledRoom.name, members: scheduledRoom.members || [] },
              });
            }
          } catch (pushErr) {
            console.error("Scheduled push failed:", pushErr.message);
          }
        } else {
          const receiverIdStr = (msg.receiverId?._id || msg.receiverId)?.toString();
          const senderIdStr = (msg.senderId?._id || msg.senderId)?.toString();
          if (receiverIdStr) io.to(receiverIdStr).emit("newMessage", msg);
          if (senderIdStr) io.to(senderIdStr).emit("newMessage", msg);
          if (receiverIdStr) {
            notifyNewMessage({ message: msg, senderName: msg.senderId?.username, receiverId: receiverIdStr });
          }
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
      // 3. Fire due message reminders ("remind me later")
      const dueReminders = await Reminder.find({
        isSent: false,
        remindAt: { $lte: now },
      })
        .limit(50)
        .populate({
          path: "messageId",
          populate: { path: "senderId", select: "username profilePic" },
        })
        .lean();

      if (dueReminders.length > 0) {
        await Reminder.updateMany(
          { _id: { $in: dueReminders.map((r) => r._id) } },
          { $set: { isSent: true, sentAt: now } }
        );

        for (const reminder of dueReminders) {
          io.to(reminder.userId.toString()).emit("reminderDue", { reminder });
        }
      }
    } catch (error) {
      console.error("Error in messageScheduler:", error.message);
    }
  }, 3000);
};
