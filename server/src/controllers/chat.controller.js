import Message from "../models/Message.model.js";
import User from "../models/User.model.js";
import Room from "../models/Room.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

// Helper to prevent Server-Side Request Forgery (SSRF)
export const isSafeUrl = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Disallow localhost and internal domain names
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return false;
    }

    // Disallow non-standard ports to prevent port scanning internal services
    if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
      return false;
    }

    // Disallow IPv4 loopback, private ranges, link-local / cloud metadata
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    if (match) {
      const o1 = Number(match[1]);
      const o2 = Number(match[2]);
      const o3 = Number(match[3]);
      const o4 = Number(match[4]);
      if (o1 > 255 || o2 > 255 || o3 > 255 || o4 > 255) return false;
      if (o1 === 127 || o1 === 0) return false; // 127.0.0.0/8, 0.0.0.0
      if (o1 === 10) return false; // 10.0.0.0/8
      if (o1 === 169 && o2 === 254) return false; // 169.254.0.0/16 (Cloud metadata)
      if (o1 === 172 && o2 >= 16 && o2 <= 31) return false; // 172.16.0.0/12
      if (o1 === 192 && o2 === 168) return false; // 192.168.0.0/16
      if (o1 >= 224) return false; // Multicast / reserved
    }

    // Disallow IPv6 loopback / private addresses
    if (hostname.includes(":") || hostname === "[::1]" || hostname === "::1") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    const usersWithMeta = await Promise.all(
      filteredUsers.map(async (u) => {
        const userObj = u.toObject();
        const lastMsg = await Message.findOne({
          $or: [
            { senderId: loggedInUserId, receiverId: u._id },
            { senderId: u._id, receiverId: loggedInUserId },
          ],
          isScheduled: { $ne: true },
        })
          .sort({ createdAt: -1 })
          .select("text image file audio createdAt senderId isDeleted");

        const unreadCount = await Message.countDocuments({
          senderId: u._id,
          receiverId: loggedInUserId,
          readBy: { $ne: loggedInUserId },
          isDeleted: false,
          isScheduled: { $ne: true },
        });

        return {
          ...userObj,
          lastMessage: lastMsg || null,
          unreadCount,
        };
      })
    );

    res.status(200).json(usersWithMeta);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getRooms = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const rooms = await Room.find()
      .populate("members", "username profilePic status")
      .populate("createdBy", "username profilePic")
      .populate("admins", "username profilePic")
      .lean();

    const roomsWithMeta = await Promise.all(
      rooms.map(async (roomObj) => {
        const lastMsg = await Message.findOne({
          roomId: roomObj._id,
          isScheduled: { $ne: true },
        })
          .sort({ createdAt: -1 })
          .populate("senderId", "username")
          .select("text image file audio createdAt senderId isDeleted")
          .lean();

        const unreadCount = await Message.countDocuments({
          roomId: roomObj._id,
          senderId: { $ne: loggedInUserId },
          readBy: { $ne: loggedInUserId },
          isDeleted: false,
          isScheduled: { $ne: true },
        });

        return {
          ...roomObj,
          lastMessage: lastMsg || null,
          unreadCount,
        };
      })
    );

    res.status(200).json(roomsWithMeta);
  } catch (error) {
    console.error("Error in getRooms: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createRoom = async (req, res) => {
  try {
    const { name, description, memberIds } = req.body;
    const userId = req.user._id;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Room name is required" });
    }

    const formattedName = name.startsWith("#") ? name.trim() : `#${name.trim()}`;
    const existingRoom = await Room.findOne({ name: formattedName });
    if (existingRoom) {
      return res.status(400).json({ error: "A room with this name already exists" });
    }

    const members = Array.from(new Set([userId.toString(), ...(memberIds || [])]));

    const newRoom = new Room({
      name: formattedName,
      description: description || "",
      members,
      createdBy: userId,
      admins: [userId],
    });

    await newRoom.save();
    await newRoom.populate("members", "username profilePic status");
    await newRoom.populate("createdBy", "username profilePic");
    await newRoom.populate("admins", "username profilePic");

    // Broadcast new room to all connected sockets
    io.emit("newRoom", newRoom);

    res.status(201).json(newRoom);
  } catch (error) {
    console.error("Error in createRoom controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'user' or 'room'
    const myId = req.user._id;
    const now = new Date();

    const baseFilter = {
      isScheduled: { $ne: true },
      parentMessageId: { $in: [null, undefined] },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    };

    if (type === "room") {
      const room = await Room.findById(id).select("members").lean();
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      const isMember = (room.members || []).some(
        (m) => m.toString() === myId.toString()
      );
      if (!isMember) {
        await Room.findByIdAndUpdate(id, { $addToSet: { members: myId } });
      }

      const messages = await Message.find({ roomId: id, ...baseFilter })
        .populate("senderId", "username profilePic")
        .sort({ createdAt: 1 })
        .lean();

      // Mark un-delivered messages as delivered
      await Message.updateMany(
        { roomId: id, senderId: { $ne: myId }, "deliveries.userId": { $ne: myId } },
        { $push: { deliveries: { userId: myId, at: new Date() } } }
      );
      io.to(id).emit("messageDelivered", { chatId: id, delivererId: myId, type: "room" });

      return res.status(200).json(messages);
    } else {
      const messages = await Message.find({
        ...baseFilter,
        $or: [
          { senderId: myId, receiverId: id },
          { senderId: id, receiverId: myId },
        ],
      })
        .populate("senderId", "username profilePic")
        .sort({ createdAt: 1 })
        .lean();

      await Message.updateMany(
        { senderId: id, receiverId: myId, "deliveries.userId": { $ne: myId } },
        { $push: { deliveries: { userId: myId, at: new Date() } } }
      );
      const senderSocketId = getReceiverSocketId(id);
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageDelivered", { chatId: myId, delivererId: myId, type: "user" });
      }

      return res.status(200).json(messages);
    }
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const {
      text,
      image,
      audio,
      file,
      replyTo,
      isForwarded,
      roomId,
      expiresIn,
      scheduledFor,
      linkPreview,
      parentMessageId,
      isEncrypted,
    } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    // Calculate expiresAt if expiresIn seconds provided
    let computedExpiresAt = null;
    if (expiresIn && !isNaN(expiresIn) && Number(expiresIn) > 0) {
      computedExpiresAt = new Date(Date.now() + Number(expiresIn) * 1000);
    }

    // Check if scheduled
    let isScheduled = false;
    let scheduledDate = null;
    if (scheduledFor) {
      const parsedDate = new Date(scheduledFor);
      if (parsedDate > new Date()) {
        isScheduled = true;
        scheduledDate = parsedDate;
      }
    }

    // Link preview auto-detection if not provided
    let resolvedPreview = linkPreview || null;
    if (!resolvedPreview && text) {
      const urlMatch = text.match(/https?:\/\/[^\s]+/i);
      if (urlMatch && isSafeUrl(urlMatch[0])) {
        try {
          const targetUrl = urlMatch[0];
          const response = await fetch(targetUrl, {
            headers: { "User-Agent": "PulseMessenger/1.0" },
            signal: AbortSignal.timeout(2000),
          });
          const html = await response.text();
          const title =
            html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
            html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
            new URL(targetUrl).hostname;
          const description =
            html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
            html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
            "";
          const image =
            html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
            null;
          const siteName =
            html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
            new URL(targetUrl).hostname;

          resolvedPreview = {
            url: targetUrl,
            title: title.trim(),
            description: description.trim(),
            image,
            siteName,
          };
        } catch {
          // Ignore preview extraction failure
        }
      }
    }

    let newMessage;
    if (roomId) {
      const room = await Room.findById(roomId).select("members").lean();
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      const isMember = (room.members || []).some(
        (m) => m.toString() === senderId.toString()
      );
      if (!isMember) {
        await Room.findByIdAndUpdate(roomId, { $addToSet: { members: senderId } });
      }

      // Room message
      newMessage = new Message({
        senderId,
        roomId,
        text,
        image,
        audio,
        file,
        replyTo,
        isForwarded: Boolean(isForwarded),
        expiresAt: computedExpiresAt,
        scheduledFor: scheduledDate,
        isScheduled,
        linkPreview: resolvedPreview,
        parentMessageId: parentMessageId || null,
        isEncrypted: Boolean(isEncrypted),
      });
      await newMessage.save();
      await newMessage.populate("senderId", "username profilePic");

      // Broadcast to room immediately only if NOT scheduled
      if (!isScheduled) {
        io.to(roomId).emit("newMessage", newMessage);
      }
    } else {
      // Direct message
      newMessage = new Message({
        senderId,
        receiverId,
        text,
        image,
        audio,
        file,
        replyTo,
        isForwarded: Boolean(isForwarded),
        expiresAt: computedExpiresAt,
        scheduledFor: scheduledDate,
        isScheduled,
        linkPreview: resolvedPreview,
        parentMessageId: parentMessageId || null,
        isEncrypted: Boolean(isEncrypted),
      });
      await newMessage.save();
      await newMessage.populate("senderId", "username profilePic");

      // Send to receiver immediately only if NOT scheduled
      if (!isScheduled) {
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("newMessage", newMessage);
        }
      }
    }

    // If this is a thread reply, update parent message thread count & last reply time
    if (parentMessageId) {
      const parent = await Message.findByIdAndUpdate(
        parentMessageId,
        {
          $inc: { threadCount: 1 },
          threadLastReply: new Date(),
        },
        { new: true }
      );
      if (parent) {
        const threadPayload = {
          parentMessageId,
          threadCount: parent.threadCount,
          threadLastReply: parent.threadLastReply,
          newReply: newMessage,
        };
        if (roomId) {
          io.to(roomId).emit("threadUpdated", threadPayload);
        } else {
          const rSocket = getReceiverSocketId(receiverId);
          const sSocket = getReceiverSocketId(senderId.toString());
          if (rSocket) io.to(rSocket).emit("threadUpdated", threadPayload);
          if (sSocket) io.to(sSocket).emit("threadUpdated", threadPayload);
        }
      }
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }

    message.isDeleted = true;
    message.text = "This message was deleted";
    message.image = null;
    message.audio = null;
    message.reactions = [];
    await message.save();

    const payload = {
      messageId: message._id,
      roomId: message.roomId,
      senderId: message.senderId,
      receiverId: message.receiverId,
    };

    if (message.roomId) {
      io.to(message.roomId.toString()).emit("messageDeleted", payload);
    } else {
      const receiverSocket = getReceiverSocketId(message.receiverId.toString());
      const senderSocket = getReceiverSocketId(message.senderId.toString());
      if (receiverSocket) io.to(receiverSocket).emit("messageDeleted", payload);
      if (senderSocket) io.to(senderSocket).emit("messageDeleted", payload);
    }

    res.status(200).json({ success: true, messageId: message._id });
  } catch (error) {
    console.error("Error in deleteMessage controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const togglePinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    message.isPinned = !message.isPinned;
    await message.save();

    const payload = {
      messageId: message._id,
      isPinned: message.isPinned,
      roomId: message.roomId,
      senderId: message.senderId,
      receiverId: message.receiverId,
    };

    if (message.roomId) {
      io.to(message.roomId.toString()).emit("messagePinned", payload);
    } else {
      const receiverSocket = getReceiverSocketId(message.receiverId.toString());
      const senderSocket = getReceiverSocketId(message.senderId.toString());
      if (receiverSocket) io.to(receiverSocket).emit("messagePinned", payload);
      if (senderSocket) io.to(senderSocket).emit("messagePinned", payload);
    }

    res.status(200).json({ messageId: message._id, isPinned: message.isPinned });
  } catch (error) {
    console.error("Error in togglePinMessage controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;
    const username = req.user.username;

    if (!emoji) {
      return res.status(400).json({ error: "Emoji is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    const existingIndex = message.reactions.findIndex(
      (r) => r.userId.toString() === userId.toString() && r.emoji === emoji
    );

    if (existingIndex > -1) {
      message.reactions.splice(existingIndex, 1);
    } else {
      message.reactions.push({ userId, username, emoji });
    }

    await message.save();

    const payload = {
      messageId: message._id,
      reactions: message.reactions,
      roomId: message.roomId,
      senderId: message.senderId,
      receiverId: message.receiverId,
    };

    if (message.roomId) {
      io.to(message.roomId.toString()).emit("messageReaction", payload);
    } else {
      const receiverSocket = getReceiverSocketId(message.receiverId.toString());
      const senderSocket = getReceiverSocketId(message.senderId.toString());
      if (receiverSocket) io.to(receiverSocket).emit("messageReaction", payload);
      if (senderSocket) io.to(senderSocket).emit("messageReaction", payload);
    }

    res.status(200).json({ messageId: message._id, reactions: message.reactions });
  } catch (error) {
    console.error("Error in reactToMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    const myId = req.user._id;

    if (type === "room") {
      await Message.updateMany(
        { roomId: id, readBy: { $ne: myId } },
        { 
          $addToSet: { readBy: myId },
          $push: { reads: { userId: myId, at: new Date() } }
        }
      );
      io.to(id).emit("messagesRead", { chatId: id, readerId: myId, type: "room" });
    } else {
      await Message.updateMany(
        { senderId: id, receiverId: myId, readBy: { $ne: myId } },
        { 
          $addToSet: { readBy: myId },
          $push: { reads: { userId: myId, at: new Date() } }
        }
      );
      const senderSocketId = getReceiverSocketId(id);
      if (senderSocketId) {
        io.to(senderSocketId).emit("messagesRead", { chatId: myId, readerId: myId, type: "user" });
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in markMessagesAsRead:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required to edit message" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You can only edit your own messages" });
    }

    if (message.isDeleted) {
      return res.status(400).json({ error: "Cannot edit a deleted message" });
    }

    message.text = text.trim();
    message.isEdited = true;
    await message.save();
    await message.populate("senderId", "username profilePic");

    const payload = {
      messageId: message._id,
      text: message.text,
      isEdited: message.isEdited,
      roomId: message.roomId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      updatedAt: message.updatedAt,
    };

    if (message.roomId) {
      io.to(message.roomId.toString()).emit("messageEdited", payload);
    } else {
      const receiverSocket = getReceiverSocketId(message.receiverId.toString());
      const senderSocket = getReceiverSocketId(message.senderId.toString());
      if (receiverSocket) io.to(receiverSocket).emit("messageEdited", payload);
      if (senderSocket) io.to(senderSocket).emit("messageEdited", payload);
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in editMessage controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const toggleStarMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    const isStarred = (message.starredBy || []).some(
      (id) => id.toString() === userId.toString()
    );

    if (isStarred) {
      message.starredBy = (message.starredBy || []).filter(
        (id) => id.toString() !== userId.toString()
      );
    } else {
      if (!message.starredBy) message.starredBy = [];
      message.starredBy.push(userId);
    }

    await message.save();

    res.status(200).json({
      messageId: message._id,
      isStarred: !isStarred,
      starredBy: message.starredBy,
    });
  } catch (error) {
    console.error("Error in toggleStarMessage controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getStarredMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'user' or 'room'
    const myId = req.user._id;

    let filter = {
      starredBy: myId,
      isDeleted: false,
    };

    if (id && id !== "all" && id !== "undefined") {
      if (type === "room") {
        filter.roomId = id;
      } else {
        filter.$or = [
          { senderId: myId, receiverId: id },
          { senderId: id, receiverId: myId },
        ];
      }
    }

    const starredMessages = await Message.find(filter)
      .populate("senderId", "username profilePic")
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json(starredMessages);
  } catch (error) {
    console.error("Error in getStarredMessages controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const previewLink = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || !url.startsWith("http") || !isSafeUrl(url)) {
      return res.status(400).json({ error: "Valid public HTTP/HTTPS URL required" });
    }

    const response = await fetch(url, {
      headers: { "User-Agent": "PulseMessenger/1.0" },
      signal: AbortSignal.timeout(3000),
    });
    const html = await response.text();

    const title =
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
      new URL(url).hostname;
    const description =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      "";
    const image =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      null;
    const siteName =
      html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      new URL(url).hostname;

    res.status(200).json({
      url,
      title: title.trim(),
      description: description.trim(),
      image,
      siteName,
    });
  } catch {
    res.status(200).json({
      url: req.query.url,
      title: new URL(req.query.url).hostname,
      description: "",
      image: null,
      siteName: new URL(req.query.url).hostname,
    });
  }
};

export const getScheduledMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    const myId = req.user._id;

    let filter = {
      senderId: myId,
      isScheduled: true,
      scheduledFor: { $gt: new Date() },
    };

    if (type === "room") {
      filter.roomId = id;
    } else {
      filter.receiverId = id;
    }

    const scheduled = await Message.find(filter).sort({ scheduledFor: 1 }).lean();
    res.status(200).json(scheduled);
  } catch (error) {
    console.error("Error in getScheduledMessages:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const cancelScheduledMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const myId = req.user._id;

    const message = await Message.findOne({
      _id: messageId,
      senderId: myId,
      isScheduled: true,
    });

    if (!message) {
      return res.status(404).json({ error: "Scheduled message not found" });
    }

    await Message.findByIdAndDelete(messageId);
    res.status(200).json({ success: true, messageId });
  } catch (error) {
    console.error("Error in cancelScheduledMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { name, description, avatar } = req.body;
    const myId = req.user._id;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const isAdmin =
      !room.createdBy ||
      room.createdBy.toString() === myId.toString() ||
      (room.admins || []).some((a) => a.toString() === myId.toString());

    if (!isAdmin) {
      return res.status(403).json({ error: "Only room admins can update settings" });
    }

    if (!room.createdBy) room.createdBy = myId;
    if (!room.admins || room.admins.length === 0) room.admins = [myId];

    if (name && name.trim()) {
      room.name = name.trim().startsWith("#") ? name.trim() : `#${name.trim()}`;
    }
    if (description !== undefined) room.description = description;
    if (avatar !== undefined) room.avatar = avatar;

    await room.save();
    await room.populate("members", "username profilePic status");
    await room.populate("createdBy", "username profilePic");
    await room.populate("admins", "username profilePic");

    io.to(roomId).emit("roomUpdated", room);
    io.emit("roomUpdated", room);

    res.status(200).json(room);
  } catch (error) {
    console.error("Error in updateRoom:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const kickRoomMember = async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const myId = req.user._id;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const isCreator = room.createdBy.toString() === myId.toString();
    const isAdmin = isCreator || (room.admins || []).some((a) => a.toString() === myId.toString());

    if (!isAdmin) {
      return res.status(403).json({ error: "Only room admins can remove members" });
    }

    if (userId.toString() === room.createdBy.toString()) {
      return res.status(400).json({ error: "Cannot remove room creator" });
    }

    room.members = room.members.filter((m) => m.toString() !== userId.toString());
    room.admins = (room.admins || []).filter((a) => a.toString() !== userId.toString());

    await room.save();
    await room.populate("members", "username profilePic status");
    await room.populate("createdBy", "username profilePic");
    await room.populate("admins", "username profilePic");

    io.to(roomId).emit("roomUpdated", room);
    io.emit("roomUpdated", room);

    res.status(200).json({ success: true, room });
  } catch (error) {
    console.error("Error in kickRoomMember:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const toggleRoomAdmin = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;
    const myId = req.user._id;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const isCreator = room.createdBy.toString() === myId.toString();
    if (!isCreator) {
      return res.status(403).json({ error: "Only the room creator can assign or revoke admin status" });
    }

    if (!room.admins) room.admins = [room.createdBy];

    const isAlreadyAdmin = room.admins.some((a) => a.toString() === userId.toString());
    if (isAlreadyAdmin) {
      room.admins = room.admins.filter((a) => a.toString() !== userId.toString());
    } else {
      room.admins.push(userId);
    }

    await room.save();
    await room.populate("members", "username profilePic status");
    await room.populate("createdBy", "username profilePic");
    await room.populate("admins", "username profilePic");

    io.to(roomId).emit("roomUpdated", room);
    io.emit("roomUpdated", room);

    res.status(200).json({ success: true, room });
  } catch (error) {
    console.error("Error in toggleRoomAdmin:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getThreadReplies = async (req, res) => {
  try {
    const { messageId } = req.params;
    const replies = await Message.find({
      parentMessageId: messageId,
      isDeleted: false,
    })
      .sort({ createdAt: 1 })
      .populate("senderId", "username profilePic");

    res.status(200).json(replies);
  } catch (error) {
    console.error("Error in getThreadReplies:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessageReceipts = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId)
      .populate("readBy", "username profilePic status")
      .populate("senderId", "username profilePic");

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.status(200).json({
      messageId: message._id,
      createdAt: message.createdAt,
      sender: message.senderId,
      readBy: message.readBy || [],
      roomId: message.roomId,
      receiverId: message.receiverId,
    });
  } catch (error) {
    console.error("Error in getMessageReceipts:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};


