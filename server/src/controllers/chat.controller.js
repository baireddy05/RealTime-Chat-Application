import Message from "../models/Message.model.js";
import User from "../models/User.model.js";
import Room from "../models/Room.model.js";
import Reminder from "../models/Reminder.model.js";
import Event from "../models/Event.model.js";
import Task from "../models/Task.model.js";
import mongoose from "mongoose";
import crypto from "crypto";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { notifyNewMessage } from "../lib/notify.js";

// Shared helper: room membership + admin checks for collaboration endpoints
const getRoomRole = async (roomId, userId) => {
  const room = await Room.findById(roomId).select("members admins createdBy").lean();
  if (!room) return { room: null, isMember: false, isAdmin: false, isCreator: false };
  const uid = userId.toString();
  const isMember = (room.members || []).some((m) => m.toString() === uid);
  const isCreator = room.createdBy?.toString() === uid;
  const isAdmin =
    isCreator || (room.admins || []).some((a) => a.toString() === uid);
  return { room, isMember, isAdmin, isCreator };
};

// Scoped group fan-out: room events go to the socket.io room plus every
// affected user's personal room — never a global broadcast. A global io.emit
// leaked group names/descriptions to all online users and made clients render
// groups they were never added to.
const emitRoomUpdated = (room, extraUserIds = []) => {
  const roomId = (room?._id || room)?.toString();
  if (!roomId) return;
  io.to(roomId).emit("roomUpdated", room);
  const ids = new Set([
    ...((room.members || []).map((m) => (m?._id || m)?.toString())),
    ...(extraUserIds || []).map((id) => id?.toString()),
  ]);
  ids.forEach((id) => {
    if (id) io.to(id).emit("roomUpdated", room);
  });
};

// Participant check: DM must involve requester; room requires membership.
const canAccessMessage = async (message, userId) => {
  if (!message || !userId) return false;
  const uid = userId.toString();
  if (message.roomId) {
    const { isMember } = await getRoomRole(message.roomId, uid);
    return isMember;
  }
  return (
    message.senderId?.toString() === uid ||
    message.receiverId?.toString() === uid
  );
};

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
    // Blocked contacts (either direction) are hidden from the sidebar
    const me = await User.findById(loggedInUserId).select("blockedUsers").lean();
    const myBlocked = (me?.blockedUsers || []).map((id) => id.toString());
    const blockers = await User.find({ blockedUsers: loggedInUserId }).select("_id").lean();
    const hiddenIds = [...myBlocked, ...blockers.map((u) => u._id.toString())];
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId, ...(hiddenIds.length > 0 ? { $nin: hiddenIds } : {}) },
    })
      .select("-password")
      .lean();
    if (filteredUsers.length === 0) return res.status(200).json([]);

    const userIds = filteredUsers.map((u) => u._id);

    // Single aggregation for the latest DM per conversation (replaces N findOne queries)
    const lastMsgs = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: loggedInUserId, receiverId: { $in: userIds } },
            { senderId: { $in: userIds }, receiverId: loggedInUserId },
          ],
          isScheduled: { $ne: true },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ["$senderId", loggedInUserId] }, "$receiverId", "$senderId"],
          },
          text: { $first: "$text" },
          image: { $first: "$image" },
          file: { $first: "$file" },
          audio: { $first: "$audio" },
          createdAt: { $first: "$createdAt" },
          senderId: { $first: "$senderId" },
          isDeleted: { $first: "$isDeleted" },
        },
      },
      {
        $project: {
          _id: 0,
          otherId: "$_id",
          text: 1,
          image: 1,
          file: 1,
          audio: 1,
          createdAt: 1,
          senderId: 1,
          isDeleted: 1,
        },
      },
    ]);

    // Single aggregation for all unread counts (replaces N countDocuments queries)
    const unreadAgg = await Message.aggregate([
      {
        $match: {
          senderId: { $in: userIds },
          receiverId: loggedInUserId,
          readBy: { $ne: loggedInUserId },
          isDeleted: false,
          isScheduled: { $ne: true },
        },
      },
      { $group: { _id: "$senderId", count: { $sum: 1 } } },
    ]);

    const lastByUser = new Map(lastMsgs.map((m) => [m.otherId.toString(), m]));
    const unreadByUser = new Map(unreadAgg.map((u) => [u._id.toString(), u.count]));

    const usersWithMeta = filteredUsers.map((u) => ({
      ...u,
      lastMessage: lastByUser.get(u._id.toString()) || null,
      unreadCount: unreadByUser.get(u._id.toString()) || 0,
    }));

    res.status(200).json(usersWithMeta);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

const fetchRoomsWithMeta = async (loggedInUserId, extraFilter = {}) => {
  try {
    const rooms = await Room.find({ members: loggedInUserId, ...extraFilter })
    .populate("members", "username profilePic status")
    .populate("createdBy", "username profilePic")
    .populate("admins", "username profilePic")
    .lean();
  if (rooms.length === 0) return [];

    const roomIds = rooms.map((r) => r._id);

    // Single aggregation for the latest message per room (replaces N findOne queries)
    const lastMsgs = await Message.aggregate([
      { $match: { roomId: { $in: roomIds }, isScheduled: { $ne: true } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$roomId",
          text: { $first: "$text" },
          image: { $first: "$image" },
          file: { $first: "$file" },
          audio: { $first: "$audio" },
          createdAt: { $first: "$createdAt" },
          senderId: { $first: "$senderId" },
          isDeleted: { $first: "$isDeleted" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "senderId",
          foreignField: "_id",
          as: "sender",
        },
      },
      { $unwind: { path: "$sender", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          roomId: "$_id",
          text: 1,
          image: 1,
          file: 1,
          audio: 1,
          createdAt: 1,
          isDeleted: 1,
          senderId: {
            _id: "$sender._id",
            username: "$sender.username",
          },
        },
      },
    ]);

    // Single aggregation for all room unread counts (replaces N countDocuments queries)
    const unreadAgg = await Message.aggregate([
      {
        $match: {
          roomId: { $in: roomIds },
          senderId: { $ne: loggedInUserId },
          readBy: { $ne: loggedInUserId },
          isDeleted: false,
          isScheduled: { $ne: true },
        },
      },
      { $group: { _id: "$roomId", count: { $sum: 1 } } },
    ]);

    const lastByRoom = new Map(lastMsgs.map((m) => [m.roomId.toString(), m]));
    const unreadByRoom = new Map(unreadAgg.map((u) => [u._id.toString(), u.count]));

    const uid = loggedInUserId.toString();
    const roomsWithMeta = rooms.map((roomObj) => {
      const meta = {
        ...roomObj,
        lastMessage: lastByRoom.get(roomObj._id.toString()) || null,
        unreadCount: unreadByRoom.get(roomObj._id.toString()) || 0,
      };
      // Invite codes and pending requests are admin eyes only
      const creatorId = (roomObj.createdBy?._id || roomObj.createdBy)?.toString();
      const isAdmin =
        creatorId === uid ||
        (roomObj.admins || []).some((a) => (a?._id || a)?.toString() === uid);
      if (!isAdmin) {
        delete meta.inviteCode;
        delete meta.joinRequests;
      }
      return meta;
    });

    return roomsWithMeta;
  } catch (error) {
    console.error("Error in fetchRoomsWithMeta: ", error.message);
    throw error;
  }
};

export const getRooms = async (req, res) => {
  try {
    // Groups only — followed channels come from getChannels
    res.status(200).json(await fetchRoomsWithMeta(req.user._id, { isChannel: { $ne: true } }));
  } catch (error) {
    console.error("Error in getRooms: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getChannels = async (req, res) => {
  try {
    res.status(200).json(await fetchRoomsWithMeta(req.user._id, { isChannel: true }));
  } catch (error) {
    console.error("Error in getChannels: ", error.message);
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

    // Notify members only: each member's personal room receives the new group
    // so it appears in their sidebar. Non-members never hear about it.
    // Auto-join all members currently connected to the new room
    members.forEach((memberId) => {
      io.in(memberId.toString()).socketsJoin(newRoom._id.toString());
      io.to(memberId.toString()).emit("newRoom", newRoom);
    });

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

    // Paginated history: `limit` caps payload (default 100, max 200),
    // `before` (ISO date) pages backwards for "load earlier" flows.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
    let beforeDate = null;
    if (req.query.before) {
      const parsed = new Date(req.query.before);
      if (!isNaN(parsed.getTime())) beforeDate = parsed;
    }
    const beforeFilter = beforeDate ? { createdAt: { $lt: beforeDate } } : {};

    const notExpired = { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] };
    const notThreadReply = { parentMessageId: null };
    const notScheduled = { isScheduled: { $ne: true } };
    const notHidden = { hiddenFor: { $ne: myId } };

    if (type === "room") {
      const room = await Room.findById(id).select("members").lean();
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      const isMember = (room.members || []).some(
        (m) => m.toString() === myId.toString()
      );
      if (!isMember) {
        return res.status(403).json({ error: "You are not a member of this room" });
      }

      const messages = await Message.find({ roomId: id, ...notScheduled, ...notThreadReply, ...notExpired, ...notHidden, ...beforeFilter })
        .populate("senderId", "username profilePic")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      messages.reverse();
      const visible = scrubViewOnce(messages, myId);

      // Mark un-delivered messages as delivered
      await Message.updateMany(
        { roomId: id, senderId: { $ne: myId }, "deliveries.userId": { $ne: myId } },
        { $push: { deliveries: { userId: myId, at: new Date() } } }
      );
      io.to(id).emit("messageDelivered", { chatId: id, delivererId: myId, type: "room" });

      return res.status(200).json(visible);
    } else {
      // NOTE: expiry + DM pair filters are combined with $and — spreading two
      // $or clauses would let the second overwrite the first.
      const messages = await Message.find({
        ...notScheduled,
        ...notThreadReply,
        ...notHidden,
        ...beforeFilter,
        $and: [
          { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
          {
            $or: [
              { senderId: myId, receiverId: id },
              { senderId: id, receiverId: myId },
            ],
          },
        ],
      })
        .populate("senderId", "username profilePic")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      messages.reverse();
      const visible = scrubViewOnce(messages, myId);

      await Message.updateMany(
        { senderId: id, receiverId: myId, "deliveries.userId": { $ne: myId } },
        { $push: { deliveries: { userId: myId, at: new Date() } } }
      );
      io.to(id.toString()).emit("messageDelivered", { chatId: myId, delivererId: myId, type: "user" });

      return res.status(200).json(visible);
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
      contact,
      replyTo,
      isForwarded,
      roomId,
      expiresIn,
      scheduledFor,
      linkPreview,
      parentMessageId,
      isEncrypted,
      isSticker,
      poll,
      isWhisper,
      isAnnouncement,
      videoMessage,
      videoNote,
      location,
      liveUntil,
      viewOnce,
    } = req.body;
    const receiverId = req.params.id || req.body.receiverId;
    const senderId = req.user._id;

    // Payload limits: prevent unbounded docs (16MB Mongo cap) and malformed polls.
    if (typeof text === "string" && text.length > 8000) {
      return res.status(400).json({ error: "Message text too long (max 8000 chars)" });
    }
    if (poll) {
      const opts = poll.options;
      if (!Array.isArray(opts) || opts.length < 2 || opts.length > 10) {
        return res.status(400).json({ error: "Poll must have 2-10 options" });
      }
      for (const o of opts) {
        if (typeof o?.text !== "string" || !o.text.trim() || o.text.length > 200) {
          return res.status(400).json({ error: "Invalid poll option" });
        }
      }
    }
    if (contact && (typeof contact !== "object" || typeof contact.username !== "string")) {
      return res.status(400).json({ error: "Invalid contact payload" });
    }
    if (file && (typeof file !== "object" || typeof file.url !== "string" || !isSafeUrl(file.url))) {
      return res.status(400).json({ error: "Invalid file payload" });
    }

    const resolvedVideoNote = videoNote || (typeof videoMessage === "string" ? videoMessage : videoMessage?.videoUrl) || null;
    let resolvedLocation = null;
    if (location) {
      const lat = location.lat ?? location.latitude;
      const lng = location.lng ?? location.longitude;
      if (lat !== undefined && lng !== undefined) {
        resolvedLocation = { lat: Number(lat), lng: Number(lng) };
      }
    }
    // Live location: accept a future expiry timestamp (15m / 1h / 8h presets)
    let resolvedLiveUntil = null;
    if (resolvedLocation && liveUntil) {
      const parsed = new Date(liveUntil);
      if (!isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
        resolvedLiveUntil = parsed;
      }
    }

    // Validate: at least one content field is required
    if (!text && !image && !audio && !file && !contact && !poll && !resolvedVideoNote && !resolvedLocation) {
      return res.status(400).json({ error: "Message must contain text, media, file, contact, poll, video note, or location" });
    }
    if (!roomId && !receiverId) {
      return res.status(400).json({ error: "Missing receiver or room" });
    }
    if (!roomId && receiverId && !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ error: "Invalid receiver id" });
    }
    if (roomId && !mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    if (!roomId && receiverId) {
      const receiverExists = await User.findById(receiverId).select("_id").lean();
      if (!receiverExists) {
        return res.status(404).json({ error: "Receiver not found" });
      }
      // Blocked contacts cannot message each other in either direction.
      // Generic error on purpose so block status isn't probed.
      const blocked = await User.findOne({
        $or: [
          { _id: senderId, blockedUsers: receiverId },
          { _id: receiverId, blockedUsers: senderId },
        ],
      })
        .select("_id")
        .lean();
      if (blocked) {
        return res.status(403).json({ error: "Message could not be delivered" });
      }
    }

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

    // Link previews are resolved on demand via GET /chat/preview-link when a
    // message becomes visible (see LinkPreview.jsx). Fetching the target URL
    // inline here used to block every send by up to 2s, so we only accept a
    // client-provided preview and never fetch synchronously on the send path.
    const resolvedPreview = linkPreview || null;

    let newMessage;
    if (roomId) {
      const room = await Room.findById(roomId).select("name members admins createdBy isChannel").lean();
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      const isMember = (room.members || []).some(
        (m) => m.toString() === senderId.toString()
      );
      if (!isMember) {
        return res.status(403).json({ error: "You are not a member of this room" });
      }

      // Broadcast channels are admin-post-only (followers read)
      if (room.isChannel) {
        const uid = senderId.toString();
        const isAdmin =
          room.createdBy?.toString() === uid ||
          (room.admins || []).some((a) => a.toString() === uid);
        if (!isAdmin) {
          return res.status(403).json({ error: "Only channel admins can post" });
        }
      }

      // Announcements are admin-only broadcasts
      let resolvedAnnouncement = false;
      if (isAnnouncement) {
        const uid = senderId.toString();
        const isAdmin =
          room.createdBy?.toString() === uid ||
          (room.admins || []).some((a) => a.toString() === uid);
        if (!isAdmin) {
          return res.status(403).json({ error: "Only group admins can post announcements" });
        }
        resolvedAnnouncement = true;
      }

      // Room message
      newMessage = new Message({
        senderId,
        roomId,
        text,
        image,
        audio,
        file,
        contact: contact || null,
        replyTo,
        isForwarded: Boolean(isForwarded),
        expiresAt: computedExpiresAt,
        scheduledFor: scheduledDate,
        isScheduled,
        linkPreview: resolvedPreview,
        parentMessageId: parentMessageId || null,
        isEncrypted: Boolean(isEncrypted),
        isSticker: Boolean(isSticker),
        poll: poll || null,
        isWhisper: Boolean(isWhisper),
        isAnnouncement: resolvedAnnouncement,
        videoNote: resolvedVideoNote,
        location: resolvedLocation,
        liveUntil: resolvedLiveUntil,
        // View-once is only meaningful for photo/voice payloads
        viewOnce: Boolean(viewOnce) && !!(image || audio),
      });
      await newMessage.save();
      await newMessage.populate("senderId", "username profilePic");

      // Broadcast to room immediately only if NOT scheduled
      if (!isScheduled) {
        io.to(roomId.toString()).emit("newMessage", newMessage);
        // Background push for members with no live socket (fire-and-forget)
        notifyNewMessage({
          message: newMessage,
          senderName: newMessage.senderId?.username,
          room: { _id: roomId, name: room?.name, members: room?.members || [] },
        });
      }
    } else {
      if (isAnnouncement) {
        return res.status(400).json({ error: "Announcements are only available in groups" });
      }
      // Direct message
      newMessage = new Message({
        senderId,
        receiverId,
        text,
        image,
        audio,
        file,
        contact: contact || null,
        replyTo,
        isForwarded: Boolean(isForwarded),
        expiresAt: computedExpiresAt,
        scheduledFor: scheduledDate,
        isScheduled,
        linkPreview: resolvedPreview,
        parentMessageId: parentMessageId || null,
        isEncrypted: Boolean(isEncrypted),
        isSticker: Boolean(isSticker),
        poll: poll || null,
        isWhisper: Boolean(isWhisper),
        videoNote: resolvedVideoNote,
        location: resolvedLocation,
        liveUntil: resolvedLiveUntil,
        // View-once is only meaningful for photo/voice payloads
        viewOnce: Boolean(viewOnce) && !!(image || audio),
      });
      await newMessage.save();
      await newMessage.populate("senderId", "username profilePic");

      // Send to receiver and sender immediately only if NOT scheduled
      if (!isScheduled && receiverId && senderId) {
        io.to(receiverId.toString()).emit("newMessage", newMessage);
        io.to(senderId.toString()).emit("newMessage", newMessage);
        // Background push when the recipient has no live socket (fire-and-forget)
        notifyNewMessage({
          message: newMessage,
          senderName: newMessage.senderId?.username,
          receiverId,
        });
      }
    }

    // If this is a thread reply, update parent message thread count & last reply time
    if (parentMessageId) {
      // Verify parent belongs to the same conversation to prevent cross-chat pollution
      const parentMsg = await Message.findById(parentMessageId).select("roomId senderId receiverId").lean();
      const sameRoom = roomId ? parentMsg?.roomId?.toString() === roomId.toString() : false;
      const sameDm = !roomId && parentMsg && !parentMsg.roomId && (
        (parentMsg.senderId?.toString() === senderId.toString() && parentMsg.receiverId?.toString() === receiverId?.toString()) ||
        (parentMsg.senderId?.toString() === receiverId?.toString() && parentMsg.receiverId?.toString() === senderId.toString())
      );
      if (!parentMsg || (!sameRoom && !sameDm)) {
        // Don't increment thread count for cross-chat parent
      } else {
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
          io.to(roomId.toString()).emit("threadUpdated", threadPayload);
        } else {
          io.to(receiverId.toString()).emit("threadUpdated", threadPayload);
          io.to(senderId.toString()).emit("threadUpdated", threadPayload);
        }
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

    const isSender = message.senderId.toString() === userId.toString();
    if (!isSender) {
      // Group/channel admins may remove anyone's message (WhatsApp-style)
      if (!message.roomId) {
        return res.status(403).json({ error: "You can only delete your own messages" });
      }
      const room = await Room.findById(message.roomId).select("admins createdBy").lean();
      if (!room) return res.status(404).json({ error: "Room not found" });
      const isAdmin =
        room.createdBy?.toString() === userId.toString() ||
        (room.admins || []).some((a) => a.toString() === userId.toString());
      if (!isAdmin) {
        return res.status(403).json({ error: "Only admins can delete this message" });
      }
    }

    message.isDeleted = true;
    message.text = "This message was deleted";
    message.image = null;
    message.audio = null;
    message.file = null;
    message.contact = null;
    message.poll = null;
    message.linkPreview = null;
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
    } else if (message.receiverId && message.senderId) {
      io.to(message.receiverId.toString()).emit("messageDeleted", payload);
      io.to(message.senderId.toString()).emit("messageDeleted", payload);
    }

    res.status(200).json({ success: true, messageId: message._id });
  } catch (error) {
    console.error("Error in deleteMessage controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete for me: hides any visible message from the requester's own views
// only. Nobody else is notified and nothing else changes.
export const hideMessageForMe = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId)
      .select("senderId receiverId roomId")
      .lean();
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    let allowed = false;
    if (message.roomId) {
      const room = await Room.findById(message.roomId).select("members").lean();
      allowed = !!room && (room.members || []).some((m) => m.toString() === userId.toString());
    } else {
      allowed = [message.senderId?.toString(), message.receiverId?.toString()].includes(
        userId.toString()
      );
    }
    if (!allowed) {
      return res.status(403).json({ error: "You are not part of this conversation" });
    }

    await Message.findByIdAndUpdate(messageId, { $addToSet: { hiddenFor: userId } });
    res.status(200).json({ success: true, messageId });
  } catch (error) {
    console.error("Error in hideMessageForMe controller:", error.message);
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

    // Only room members can pin; DMs allow either participant
    if (message.roomId) {
      const room = await Room.findById(message.roomId).select("members").lean();
      if (!room) return res.status(404).json({ error: "Room not found" });
      const isMember = (room.members || []).some((m) => m.toString() === req.user._id.toString());
      if (!isMember) return res.status(403).json({ error: "Not a room member" });
    } else if (message.receiverId && message.senderId) {
      const uid = req.user._id.toString();
      const isParticipant =
        message.receiverId.toString() === uid || message.senderId.toString() === uid;
      if (!isParticipant) return res.status(403).json({ error: "Not a participant" });
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
    } else if (message.receiverId && message.senderId) {
      io.to(message.receiverId.toString()).emit("messagePinned", payload);
      io.to(message.senderId.toString()).emit("messagePinned", payload);
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

    if (!emoji || typeof emoji !== "string" || emoji.length > 16) {
      return res.status(400).json({ error: "Emoji is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (!(await canAccessMessage(message, userId))) {
      return res.status(403).json({ error: "Not a participant" });
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
    } else if (message.receiverId && message.senderId) {
      io.to(message.receiverId.toString()).emit("messageReaction", payload);
      io.to(message.senderId.toString()).emit("messageReaction", payload);
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
    const sendReadReceipts = req.user.readReceipts !== false;

    if (type === "room") {
      const filter = { roomId: id, readBy: { $ne: myId } };
      const updateOp = { $addToSet: { readBy: myId } };
      if (sendReadReceipts) {
        // Only push a read entry if this user hasn't already read (prevents unbounded growth)
        filter["reads.userId"] = { $ne: myId };
        updateOp.$push = { reads: { userId: myId, at: new Date() } };
      }
      
      await Message.updateMany(
        filter,
        updateOp
      );
      
      if (sendReadReceipts) {
        io.to(id.toString()).emit("messagesRead", { chatId: id, readerId: myId, type: "room" });
      }
    } else {
      const filter = { senderId: id, receiverId: myId, readBy: { $ne: myId } };
      const updateOp = { $addToSet: { readBy: myId } };
      if (sendReadReceipts) {
        filter["reads.userId"] = { $ne: myId };
        updateOp.$push = { reads: { userId: myId, at: new Date() } };
      }

      await Message.updateMany(
        filter,
        updateOp
      );
      
      if (sendReadReceipts) {
        io.to(id.toString()).emit("messagesRead", { chatId: myId, readerId: myId, type: "user" });
        io.to(myId.toString()).emit("messagesRead", { chatId: id, readerId: myId, type: "user" });
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in markMessagesAsRead:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const votePoll = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { optionIndex } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message || !message.poll) {
      return res.status(404).json({ error: "Poll not found" });
    }

    if (!(await canAccessMessage(message, userId))) {
      return res.status(403).json({ error: "Not a participant" });
    }

    if (!Number.isInteger(optionIndex)) {
      return res.status(400).json({ error: "Invalid option index" });
    }

    const option = message.poll.options[optionIndex];
    if (!option) {
      return res.status(400).json({ error: "Invalid option index" });
    }

    const hasVotedThisOption = option.votes.some((id) => id.toString() === userId.toString());

    if (!message.poll.multipleAnswers) {
      // Remove previous vote if single answer
      message.poll.options.forEach((opt) => {
        opt.votes = opt.votes.filter((id) => id.toString() !== userId.toString());
      });
    }

    if (hasVotedThisOption) {
      // If it's a multiple answer poll, we remove it here.
      // If it's single answer, it was already removed by the filter above.
      if (message.poll.multipleAnswers) {
        const existingVoteIndex = option.votes.findIndex((id) => id.toString() === userId.toString());
        if (existingVoteIndex !== -1) option.votes.splice(existingVoteIndex, 1);
      }
    } else {
      // Add the vote
      option.votes.push(userId);
    }

    await message.save();
    await message.populate("senderId", "username profilePic");

    const targetId = message.roomId ? message.roomId.toString() : (
      message.senderId._id.toString() === userId.toString() ? message.receiverId.toString() : message.senderId._id.toString()
    );

    // Broadcast updated poll
    io.to(targetId).emit("pollUpdated", {
      messageId: message._id,
      poll: message.poll
    });
    // Send to oneself if DM
    if (!message.roomId) {
      io.to(userId.toString()).emit("pollUpdated", {
        messageId: message._id,
        poll: message.poll
      });
    }

    res.status(200).json({ messageId: message._id, poll: message.poll });
  } catch (error) {
    console.error("Error in votePoll:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const viewWhisper = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message || !message.isWhisper) {
      return res.status(404).json({ error: "Whisper not found" });
    }

    if (!(await canAccessMessage(message, userId))) {
      return res.status(403).json({ error: "Not a participant" });
    }

    if (message.isDeleted) {
      return res.status(400).json({ error: "Whisper already viewed" });
    }

    // Mark as viewed/deleted immediately
    message.isDeleted = true;
    message.text = "This whisper has vanished.";
    message.image = null;
    message.audio = null;
    message.file = null;
    
    await message.save();

    const targetId = message.roomId ? message.roomId.toString() : (
      message.senderId.toString() === userId.toString() ? message.receiverId.toString() : message.senderId.toString()
    );

    // Broadcast deletion
    io.to(targetId).emit("messageDeleted", {
      messageId: message._id,
      chatId: targetId
    });
    
    if (!message.roomId) {
      io.to(userId.toString()).emit("messageDeleted", {
        messageId: message._id,
        chatId: message.senderId.toString() === userId.toString() ? message.receiverId.toString() : message.senderId.toString()
      });
    }

    res.status(200).json({ success: true, messageId: message._id });
  } catch (error) {
    console.error("Error in viewWhisper:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Open a view-once photo/voice note. The content URL is returned a single
// time per viewer; once every recipient has opened it the payload is wiped
// and all parties are told it was consumed.
export const viewOnceMedia = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message || !message.viewOnce) {
      return res.status(404).json({ error: "View-once media not found" });
    }
    if (message.isDeleted) {
      return res.status(410).json({ error: "This view-once media is gone" });
    }

    // Must be a conversation participant
    let allowed = false;
    let audience = [];
    if (message.roomId) {
      const room = await Room.findById(message.roomId).select("members").lean();
      allowed = !!room && (room.members || []).some((m) => m.toString() === userId.toString());
      audience = (room?.members || []).map((m) => m.toString()).filter((id) => id !== message.senderId.toString());
    } else {
      allowed = [message.senderId?.toString(), message.receiverId?.toString()].includes(userId.toString());
      if (message.receiverId) audience = [message.receiverId.toString()];
    }
    if (!allowed) {
      return res.status(403).json({ error: "You are not part of this conversation" });
    }

    const mediaUrl = message.image || message.audio || null;
    const isSender = message.senderId.toString() === userId.toString();
    // The sender can always re-view what they sent without consuming it
    if (isSender) {
      if (!mediaUrl) return res.status(410).json({ error: "This view-once media is gone" });
      return res.status(200).json({
        success: true,
        url: mediaUrl,
        type: message.image ? "image" : "audio",
        consumed: false,
      });
    }

    if ((message.viewedOnceBy || []).some((id) => id.toString() === userId.toString())) {
      return res.status(410).json({ error: "You already opened this view-once media" });
    }
    if (!mediaUrl) {
      return res.status(410).json({ error: "This view-once media is gone" });
    }

    message.viewedOnceBy = [...(message.viewedOnceBy || []), userId];
    const viewedSet = new Set(message.viewedOnceBy.map((id) => id.toString()));
    const fullyViewed = audience.length === 0 || audience.every((id) => viewedSet.has(id));

    if (fullyViewed) {
      message.image = null;
      message.audio = null;
    }
    await message.save();

    if (fullyViewed) {
      const payload = { messageId: message._id };
      if (message.roomId) {
        io.to(message.roomId.toString()).emit("viewOnceConsumed", payload);
      } else {
        io.to(message.receiverId.toString()).emit("viewOnceConsumed", payload);
        io.to(message.senderId.toString()).emit("viewOnceConsumed", payload);
      }
    }

    res.status(200).json({
      success: true,
      url: mediaUrl,
      type: message.image ? "image" : "audio",
      consumed: fullyViewed,
    });
  } catch (error) {
    console.error("Error in viewOnceMedia:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Strip view-once payloads the requesting viewer may no longer see:
// already-opened by them, or fully consumed by everyone.
export const scrubViewOnce = (docs, viewerId) => {
  const vid = viewerId?.toString();
  return (docs || []).map((m) => {
    if (!m?.viewOnce) return m;
    const viewedByMe = (m.viewedOnceBy || []).some((id) => (id?._id || id)?.toString() === vid);
    const hasMedia = !!(m.image || m.audio);
    if (!hasMedia || viewedByMe) {
      return { ...m, image: null, audio: null, viewedOnceBy: [], viewOnceOpened: true };
    }
    return { ...m, viewedOnceBy: [] };
  });
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
      io.to(message.receiverId.toString()).emit("messageEdited", payload);
      io.to(message.senderId.toString()).emit("messageEdited", payload);
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

    if (!(await canAccessMessage(message, userId))) {
      return res.status(403).json({ error: "Not a participant" });
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
      hiddenFor: { $ne: myId },
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
  const safeFallback = (raw) => {
    let host = "link";
    try {
      host = new URL(String(raw)).hostname || host;
    } catch {}
    return {
      url: typeof raw === "string" ? raw.slice(0, 2048) : "",
      title: host,
      description: "",
      image: null,
      siteName: host,
    };
  };
  try {
    const { url } = req.query;
    if (typeof url !== "string" || !url.startsWith("http") || !isSafeUrl(url)) {
      return res.status(400).json({ error: "Valid public HTTP/HTTPS URL required" });
    }

    const response = await fetch(url, {
      headers: { "User-Agent": "PulseMessenger/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(3000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      return res.status(200).json(safeFallback(url));
    }
    if (!response.ok) return res.status(200).json(safeFallback(url));
    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html/i.test(contentType)) return res.status(200).json(safeFallback(url));
    const html = (await response.text()).slice(0, 500000);

    let title = "link";
    let siteName = "link";
    try {
      title =
        html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
        html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
        new URL(url).hostname;
      siteName =
        html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
        new URL(url).hostname;
    } catch {
      title = safeFallback(url).title;
      siteName = title;
    }

    const description =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      "";
    let image =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      null;
    if (image && (typeof image !== "string" || !isSafeUrl(image))) image = null;

    res.status(200).json({
      url,
      title: String(title || "").trim().slice(0, 300),
      description: String(description || "").trim().slice(0, 500),
      image,
      siteName: String(siteName || "").slice(0, 200),
    });
  } catch {
    res.status(200).json(safeFallback(req.query.url));
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

    emitRoomUpdated(room);

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

    if (!mongoose.Types.ObjectId.isValid(roomId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const isCreator = room.createdBy?.toString() === myId.toString();
    const isAdmin = isCreator || (room.admins || []).some((a) => a.toString() === myId.toString());

    if (!isAdmin) {
      return res.status(403).json({ error: "Only room admins can remove members" });
    }

    if (room.createdBy && userId.toString() === room.createdBy.toString()) {
      return res.status(400).json({ error: "Cannot remove room creator" });
    }

    room.members = room.members.filter((m) => m.toString() !== userId.toString());
    room.admins = (room.admins || []).filter((a) => a.toString() !== userId.toString());
    room.followers = (room.followers || []).filter((f) => f.toString() !== userId.toString());

    await room.save();
    await room.populate("members", "username profilePic status");
    await room.populate("createdBy", "username profilePic");
    await room.populate("admins", "username profilePic");

    // The removed member is passed explicitly so their other tabs/devices
    // drop the group too (they are no longer in room.members).
    emitRoomUpdated(room, [userId]);

    res.status(200).json({ success: true, room });
  } catch (error) {
    console.error("Error in kickRoomMember:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const addRoomMembers = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { memberIds } = req.body;
    const myId = req.user._id;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: "memberIds must be a non-empty array" });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const isCreator = room.createdBy?.toString() === myId.toString();
    const isAdmin =
      isCreator || (room.admins || []).some((a) => a.toString() === myId.toString());

    if (!isAdmin) {
      return res.status(403).json({ error: "Only group admins can add members" });
    }

    const uniqueIds = [...new Set(memberIds.map((id) => id?.toString()).filter(Boolean))];
    if (uniqueIds.length === 0) {
      return res.status(400).json({ error: "No valid member ids provided" });
    }
    if (!uniqueIds.every((id) => mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ error: "Invalid member id" });
    }
    if (uniqueIds.length > 50) {
      return res.status(400).json({ error: "Cannot add more than 50 members at once" });
    }

    const existingUsers = await User.find({ _id: { $in: uniqueIds } })
      .select("_id")
      .lean();
    if (existingUsers.length !== uniqueIds.length) {
      return res.status(404).json({ error: "One or more users not found" });
    }

    await Room.updateOne(
      { _id: roomId },
      { $addToSet: { members: { $each: uniqueIds } } }
    );

    const updated = await Room.findById(roomId);
    await updated.populate("members", "username profilePic status");
    await updated.populate("createdBy", "username profilePic");
    await updated.populate("admins", "username profilePic");

    // New members receive live updates immediately: join their sockets to the room
    uniqueIds.forEach((memberId) => {
      io.in(memberId.toString()).socketsJoin(roomId.toString());
    });
    emitRoomUpdated(updated);

    res.status(200).json({ success: true, room: updated });
  } catch (error) {
    console.error("Error in addRoomMembers:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const toggleRoomAdmin = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;
    const myId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(roomId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const isCreator = room.createdBy?.toString() === myId.toString();
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

    emitRoomUpdated(room);

    res.status(200).json({ success: true, room });
  } catch (error) {
    console.error("Error in toggleRoomAdmin:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ---- Group invite links, leave & delete ----

const generateInviteCode = () => crypto.randomBytes(6).toString("base64url");

// Admin-only: return the current invite code, generating one if needed
export const getOrCreateInvite = async (req, res) => {
  try {
    const { roomId } = req.params;
    const myId = req.user._id;
    const { room, isAdmin } = await getRoomRole(roomId, myId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!isAdmin) return res.status(403).json({ error: "Only group admins can manage invite links" });

    let doc = await Room.findById(roomId).select("inviteCode").lean();
    if (!doc?.inviteCode) {
      for (let i = 0; i < 3; i++) {
        try {
          const updated = await Room.findByIdAndUpdate(
            roomId,
            { $set: { inviteCode: generateInviteCode() } },
            { new: true }
          )
            .select("inviteCode")
            .lean();
          doc = updated;
          break;
        } catch (e) {
          if (e?.code !== 11000) throw e; // retry once on random collision
        }
      }
    }
    if (!doc?.inviteCode) return res.status(500).json({ error: "Could not generate invite link" });
    res.status(200).json({ inviteCode: doc.inviteCode });
  } catch (error) {
    console.error("Error in getOrCreateInvite:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Admin-only: revoke the invite link (old links stop working immediately)
export const revokeInvite = async (req, res) => {
  try {
    const { roomId } = req.params;
    const myId = req.user._id;
    const { room, isAdmin } = await getRoomRole(roomId, myId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!isAdmin) return res.status(403).json({ error: "Only group admins can manage invite links" });

    await Room.findByIdAndUpdate(roomId, { $unset: { inviteCode: "" } });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in revokeInvite:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Join a group with an invite code (any authenticated user)
export const joinRoomByCode = async (req, res) => {
  try {
    const code = (req.params.code || "").trim();
    const myId = req.user._id;
    if (!code) return res.status(400).json({ error: "Invite code is required" });

    const room = await Room.findOne({ inviteCode: code });
    if (!room) return res.status(404).json({ error: "Invalid or expired invite link" });

    const alreadyMember = (room.members || []).some((m) => m.toString() === myId.toString());
    if (alreadyMember) {
      await room.populate("members", "username profilePic status");
      await room.populate("createdBy", "username profilePic");
      await room.populate("admins", "username profilePic");
      return res.status(200).json(room.toObject());
    }

    // Groups with approval enabled queue a request instead of instant join
    if (room.requireApproval && !room.isChannel) {
      await Room.updateOne({ _id: room._id }, { $addToSet: { joinRequests: myId } });
      const admins = [...(room.admins || []).map((a) => a.toString())];
      if (room.createdBy) admins.push(room.createdBy.toString());
      [...new Set(admins)].forEach((adminId) => {
        io.to(adminId).emit("joinRequestReceived", { roomId: room._id, userId: myId });
      });
      return res.status(202).json({ success: true, requested: true, roomId: room._id, name: room.name });
    }
    if (!alreadyMember) {
      room.members.push(myId);
      await room.save();
    }
    await room.populate("members", "username profilePic status");
    await room.populate("createdBy", "username profilePic");
    await room.populate("admins", "username profilePic");

    // Strip the invite code from what the joiner receives (admins manage it)
    const roomObj = room.toObject();
    delete roomObj.inviteCode;
    delete roomObj.joinRequests;

    io.in(myId.toString()).socketsJoin(room._id.toString());
    io.to(myId.toString()).emit("newRoom", room);
    emitRoomUpdated(room);

    res.status(200).json(roomObj);
  } catch (error) {
    console.error("Error in joinRoomByCode:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Leave a group. Creator ownership transfers to a remaining admin/member;
// the last member out deletes the group and its messages.
export const leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const myId = req.user._id;
    const { room, isMember, isCreator } = await getRoomRole(roomId, myId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!isMember) return res.status(403).json({ error: "You are not a member of this room" });

    const remaining = (room.members || []).filter((m) => m.toString() !== myId.toString());
    if (remaining.length === 0) {
      await Message.deleteMany({ roomId });
      await Event.deleteMany({ roomId });
      await Task.deleteMany({ roomId });
      await Room.findByIdAndDelete(roomId);
      io.to(roomId.toString()).emit("roomDeleted", { roomId });
      io.to(myId.toString()).emit("roomDeleted", { roomId });
      return res.status(200).json({ success: true, deleted: true, roomId });
    }

    let newCreator = null;
    let update;
    if (isCreator) {
      const remainingAdmins = (room.admins || [])
        .map((a) => a.toString())
        .filter((a) => a !== myId.toString() && remaining.some((m) => m.toString() === a));
      newCreator = remainingAdmins[0] || remaining[0].toString();
      // $pull and $addToSet cannot target the same path in one update,
      // so the post-leave admin list is computed here and $set instead.
      const adminsSet = new Set((room.admins || []).map((a) => a.toString()));
      adminsSet.delete(myId.toString());
      adminsSet.add(newCreator);
      update = {
        $pull: { members: myId, followers: myId },
        $set: { createdBy: newCreator, admins: [...adminsSet] },
      };
    } else {
      update = { $pull: { members: myId, admins: myId, followers: myId } };
    }
    const updated = await Room.findByIdAndUpdate(roomId, update, { new: true });
    await updated.populate("members", "username profilePic status");
    await updated.populate("createdBy", "username profilePic");
    await updated.populate("admins", "username profilePic");

    emitRoomUpdated(updated, [myId]);

    res.status(200).json({ success: true, room: updated, transferredTo: newCreator });
  } catch (error) {
    console.error("Error in leaveRoom:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Creator-only: delete the group, its messages, events and tasks
export const deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const myId = req.user._id;
    const { room, isCreator } = await getRoomRole(roomId, myId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!isCreator) {
      return res.status(403).json({ error: "Only the group creator can delete the group" });
    }

    const memberIds = (room.members || []).map((m) => m.toString());
    await Message.deleteMany({ roomId });
    await Event.deleteMany({ roomId });
    await Task.deleteMany({ roomId });
    await Room.findByIdAndDelete(roomId);

    io.to(roomId.toString()).emit("roomDeleted", { roomId });
    memberIds.forEach((id) => io.to(id).emit("roomDeleted", { roomId }));

    res.status(200).json({ success: true, roomId });
  } catch (error) {
    console.error("Error in deleteRoom:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ---- Broadcast channels (public, admin-post-only rooms) ----

export const createChannel = async (req, res) => {
  try {
    const { name, description, avatar } = req.body;
    const userId = req.user._id;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Channel name is required" });
    }
    const formattedName = name.startsWith("#") ? name.trim() : `#${name.trim()}`;
    const existingRoom = await Room.findOne({ name: formattedName });
    if (existingRoom) {
      return res.status(400).json({ error: "A group or channel with this name already exists" });
    }

    const newRoom = new Room({
      name: formattedName,
      description: description || "",
      avatar: avatar || "",
      members: [userId],
      followers: [userId],
      createdBy: userId,
      admins: [userId],
      isChannel: true,
    });

    await newRoom.save();

    const populated = await Room.findById(newRoom._id)
      .populate("members", "username profilePic status")
      .populate("createdBy", "username profilePic")
      .populate("admins", "username profilePic")
      .lean();

    io.in(userId.toString()).socketsJoin(populated._id.toString());
    io.to(userId.toString()).emit("newRoom", populated);

    res.status(201).json(populated);
  } catch (error) {
    console.error("Error in createChannel controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Public directory: every channel with follower counts + my follow state
export const getPublicChannels = async (req, res) => {
  try {
    const myId = req.user._id.toString();
    const q = (req.query.q || "").trim().slice(0, 50);
    const filter = { isChannel: true };
    if (q) {
      filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }
    const channels = await Room.find(filter)
      .select("name description avatar createdBy createdAt members followers")
      .populate("createdBy", "username")
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    res.status(200).json(
      channels.map((c) => ({
        _id: c._id,
        name: c.name,
        description: c.description,
        avatar: c.avatar,
        createdBy: c.createdBy,
        createdAt: c.createdAt,
        followersCount: (c.followers || []).length,
        followed: (c.followers || []).some((f) => (f?._id || f)?.toString() === myId),
      }))
    );
  } catch (error) {
    console.error("Error in getPublicChannels:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const followChannel = async (req, res) => {
  try {
    const { roomId } = req.params;
    const myId = req.user._id;

    const room = await Room.findById(roomId);
    if (!room || !room.isChannel) {
      return res.status(404).json({ error: "Channel not found" });
    }
    await Room.updateOne(
      { _id: roomId },
      { $addToSet: { members: myId, followers: myId } }
    );
    const updated = await Room.findById(roomId)
      .populate("members", "username profilePic status")
      .populate("createdBy", "username profilePic")
      .populate("admins", "username profilePic")
      .lean();

    io.in(myId.toString()).socketsJoin(roomId.toString());
    io.to(myId.toString()).emit("newRoom", updated);
    emitRoomUpdated(updated);

    res.status(200).json(updated);
  } catch (error) {
    console.error("Error in followChannel:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const unfollowChannel = async (req, res) => {
  try {
    const { roomId } = req.params;
    const myId = req.user._id;

    const room = await Room.findById(roomId).select("isChannel admins createdBy").lean();
    if (!room || !room.isChannel) {
      return res.status(404).json({ error: "Channel not found" });
    }
    // Admins/creator keep their seat; use Leave for ownership changes
    await Room.updateOne(
      { _id: roomId },
      { $pull: { members: myId, followers: myId } }
    );
    io.to(myId.toString()).emit("roomDeleted", { roomId });

    res.status(200).json({ success: true, roomId });
  } catch (error) {
    console.error("Error in unfollowChannel:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Toggle "approve new members" (admin-only). When on, invite-code joins
// become requests instead of instant joins.
export const toggleJoinApproval = async (req, res) => {
  try {
    const { roomId } = req.params;
    const myId = req.user._id;
    const { room, isAdmin } = await getRoomRole(roomId, myId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!isAdmin) return res.status(403).json({ error: "Only group admins can change this setting" });
    if (room.isChannel) {
      return res.status(400).json({ error: "Channels are public — approval does not apply" });
    }

    const updated = await Room.findByIdAndUpdate(
      roomId,
      { $set: { requireApproval: !room.requireApproval } },
      { new: true }
    )
      .populate("members", "username profilePic status")
      .populate("createdBy", "username profilePic")
      .populate("admins", "username profilePic")
      .lean();
    emitRoomUpdated(updated);

    res.status(200).json({ success: true, requireApproval: updated.requireApproval, room: updated });
  } catch (error) {
    console.error("Error in toggleJoinApproval:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Admin-only: pending join requests with requester profiles
export const getJoinRequests = async (req, res) => {
  try {
    const { roomId } = req.params;
    const myId = req.user._id;
    const { room, isAdmin } = await getRoomRole(roomId, myId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!isAdmin) return res.status(403).json({ error: "Only group admins can view requests" });

    const full = await Room.findById(roomId)
      .select("joinRequests")
      .populate("joinRequests", "username profilePic status")
      .lean();
    res.status(200).json(full?.joinRequests || []);
  } catch (error) {
    console.error("Error in getJoinRequests:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Admin-only: approve (joins + live sync) or deny a join request
export const resolveJoinRequest = async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const { action } = req.body || {};
    const myId = req.user._id;
    const { room, isAdmin } = await getRoomRole(roomId, myId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!isAdmin) return res.status(403).json({ error: "Only group admins can resolve requests" });
    if (!["approve", "deny"].includes(action)) {
      return res.status(400).json({ error: "action must be approve or deny" });
    }

    if (action === "approve") {
      await Room.updateOne(
        { _id: roomId },
        { $addToSet: { members: userId }, $pull: { joinRequests: userId } }
      );
      const updated = await Room.findById(roomId)
        .populate("members", "username profilePic status")
        .populate("createdBy", "username profilePic")
        .populate("admins", "username profilePic")
        .lean();
      io.in(userId.toString()).socketsJoin(roomId.toString());
      io.to(userId.toString()).emit("newRoom", updated);
      emitRoomUpdated(updated);
      return res.status(200).json({ success: true, approved: true, room: updated });
    }

    await Room.updateOne({ _id: roomId }, { $pull: { joinRequests: userId } });
    res.status(200).json({ success: true, approved: false });
  } catch (error) {
    console.error("Error in resolveJoinRequest:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ---- Live location sharing ----

const emitLocationUpdated = (msg) => {
  const payload = {
    messageId: msg._id,
    location: msg.location,
    liveUntil: msg.liveUntil,
  };
  if (msg.roomId) {
    io.to(msg.roomId.toString()).emit("locationUpdated", payload);
  } else if (msg.receiverId && msg.senderId) {
    io.to(msg.receiverId.toString()).emit("locationUpdated", payload);
    io.to(msg.senderId.toString()).emit("locationUpdated", payload);
  }
};

// Sender pushes a fresh GPS fix for their live location message
export const updateLiveLocation = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { lat, lng } = req.body || {};
    const myId = req.user._id;

    if (typeof lat !== "number" || typeof lng !== "number" || !isFinite(lat) || !isFinite(lng)) {
      return res.status(400).json({ error: "Valid lat/lng numbers are required" });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: "Coordinates out of range" });
    }

    const msg = await Message.findById(messageId).select("senderId roomId receiverId location liveUntil");
    if (!msg || !msg.location) {
      return res.status(404).json({ error: "Location message not found" });
    }
    if (msg.senderId.toString() !== myId.toString()) {
      return res.status(403).json({ error: "Only the sender can update a live location" });
    }
    if (!msg.liveUntil || new Date(msg.liveUntil).getTime() <= Date.now()) {
      return res.status(410).json({ error: "Live location sharing has ended" });
    }

    msg.location = { lat, lng };
    await msg.save();
    emitLocationUpdated(msg);

    res.status(200).json({ success: true, location: msg.location, liveUntil: msg.liveUntil });
  } catch (error) {
    console.error("Error in updateLiveLocation:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Sender stops sharing early
export const stopLiveLocation = async (req, res) => {
  try {
    const { messageId } = req.params;
    const myId = req.user._id;

    const msg = await Message.findById(messageId).select("senderId roomId receiverId location liveUntil");
    if (!msg || !msg.location) {
      return res.status(404).json({ error: "Location message not found" });
    }
    if (msg.senderId.toString() !== myId.toString()) {
      return res.status(403).json({ error: "Only the sender can stop a live location" });
    }
    msg.liveUntil = new Date();
    await msg.save();
    emitLocationUpdated(msg);

    res.status(200).json({ success: true, liveUntil: msg.liveUntil });
  } catch (error) {
    console.error("Error in stopLiveLocation:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getThreadReplies = async (req, res) => {
  try {
    const { messageId } = req.params;
    const parent = await Message.findById(messageId).select("senderId receiverId roomId");
    if (!parent) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (!(await canAccessMessage(parent, req.user._id))) {
      return res.status(403).json({ error: "Not a participant" });
    }
    const replies = await Message.find({
      parentMessageId: messageId,
      isDeleted: false,
      hiddenFor: { $ne: req.user._id },
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

    if (!(await canAccessMessage(message, req.user._id))) {
      return res.status(403).json({ error: "Not a participant" });
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

export const proxyDownloadFile = async (req, res) => {
  try {
    const { url, filename } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "File URL is required" });
    }

    // Validate URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return res.status(400).json({ error: "Only HTTP and HTTPS protocols are supported" });
    }

    // Block server-side request forgery: no localhost / internal / cloud-metadata URLs
    if (!isSafeUrl(url)) {
      return res.status(400).json({ error: "URL is not allowed" });
    }

    // Clean and sanitize filename
    let rawFilename = typeof filename === "string" && filename.trim() ? filename.trim() : "document.pdf";
    if (!rawFilename.includes(".") && url.toLowerCase().includes(".pdf")) {
      rawFilename += ".pdf";
    }
    const cleanFilename = rawFilename.replace(/[\r\n"\\/<>:|?*]/g, "_");

    const remoteResponse = await fetch(url, {
      headers: {
        "User-Agent": "PulseMessenger/1.0 (Windows NT 10.0; Win64; x64)",
      },
      // Don't hang on slow servers; manual redirect so each hop is re-validated
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });

    // Re-validate redirect targets (fetch manual => no auto-follow to metadata endpoints).
    if ([301, 302, 303, 307, 308].includes(remoteResponse.status)) {
      const loc = remoteResponse.headers.get("location");
      if (!loc || !isSafeUrl(new URL(loc, url).toString())) {
        return res.status(400).json({ error: "Redirect target not allowed" });
      }
      return res.status(400).json({ error: "Redirects not followed for safety" });
    }

    if (!remoteResponse.ok) {
      return res.status(502).json({
        error: `Failed to fetch file from source`,
      });
    }

    // Refuse to buffer huge files into memory (DoS protection)
    const MAX_PROXY_BYTES = 25 * 1024 * 1024;
    const contentLengthHeader = remoteResponse.headers.get("content-length");
    if (contentLengthHeader && Number(contentLengthHeader) > MAX_PROXY_BYTES) {
      return res.status(413).json({ error: "File too large to proxy" });
    }

    let contentType = remoteResponse.headers.get("content-type") || "application/octet-stream";
    if (cleanFilename.toLowerCase().endsWith(".pdf")) {
      contentType = "application/pdf";
    }

    const contentLength = remoteResponse.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${cleanFilename}"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}`
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    const arrayBuffer = await remoteResponse.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_PROXY_BYTES) {
      return res.status(413).json({ error: "File too large to proxy" });
    }
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error("Error in proxyDownloadFile:", error.message);
    return res.status(500).json({ error: "Failed to download file" });
  }
};

export const toggleArchiveChat = async (req, res) => {
  try {
    const { id: chatId } = req.params;
    const userId = req.user._id;

    if (!chatId || typeof chatId !== "string" || chatId.length > 64 || chatId.includes(".") || chatId.includes("$")) {
      return res.status(400).json({ error: "Invalid chat id" });
    }

    const existing = await User.findById(userId).select("chatPreferences").lean();
    if (!existing) return res.status(404).json({ error: "User not found" });
    const isArchived = existing?.chatPreferences?.[chatId]?.archived || false;

    // Atomic dot-notation update: spreading a Mongoose Map subdocument loses
    // its paths, so read-modify-save silently drops repeat writes.
    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { [`chatPreferences.${chatId}.archived`]: !isArchived } },
      { returnDocument: "after" }
    ).select("chatPreferences").lean();

    res.status(200).json({
      success: true,
      chatId,
      archived: !isArchived,
      preferences: updated?.chatPreferences?.[chatId] || { archived: !isArchived }
    });
  } catch (error) {
    console.error("Error in toggleArchiveChat: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Merge per-chat preferences (currently: default disappearing timer,
// notification tone, cross-device lock flag). Pass null values to clear
// individual settings. NOTE: `locked` only records THAT a chat is locked so
// other devices show the PIN gate — the PIN hash itself never leaves a device.
export const setChatPreferences = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { disappearing, tone, locked } = req.body || {};
    const userId = req.user._id;

    if (!chatId || typeof chatId !== "string" || chatId.length > 64 || chatId.includes(".") || chatId.includes("$")) {
      return res.status(400).json({ error: "Invalid chat id" });
    }
    if (disappearing !== null && disappearing !== undefined && ![5, 60, 3600, 86400].includes(Number(disappearing))) {
      return res.status(400).json({ error: "Invalid disappearing timer value" });
    }
    if (tone !== null && tone !== undefined && !["chime", "bell", "pop", "marimba"].includes(tone)) {
      return res.status(400).json({ error: "Invalid notification tone" });
    }
    if (locked !== null && locked !== undefined && typeof locked !== "boolean") {
      return res.status(400).json({ error: "Invalid lock flag" });
    }

    // Atomic dot-notation update: spreading a Mongoose Map subdocument loses
    // its paths, so read-modify-save silently drops every write after the first.
    const update = {};
    if (disappearing !== undefined) update[`chatPreferences.${chatId}.disappearing`] = disappearing;
    if (tone !== undefined) update[`chatPreferences.${chatId}.tone`] = tone;
    if (locked !== undefined) update[`chatPreferences.${chatId}.locked`] = locked;

    if (Object.keys(update).length === 0) {
      const existing = await User.findById(userId).select("chatPreferences").lean();
      if (!existing) return res.status(404).json({ error: "User not found" });
      return res.status(200).json({
        success: true,
        chatId,
        preferences: existing?.chatPreferences?.[chatId] || {},
      });
    }

    const updated = await User.findByIdAndUpdate(userId, { $set: update }, { returnDocument: "after" })
      .select("chatPreferences")
      .lean();
    if (!updated) return res.status(404).json({ error: "User not found" });

    res.status(200).json({
      success: true,
      chatId,
      preferences: updated?.chatPreferences?.[chatId] || {},
    });
  } catch (error) {
    console.error("Error in setChatPreferences: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Toggle a chat pinned to the top of the sidebar (stored as id strings,
// works for both groups and DMs, max 20 pins)
export const togglePinChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const myId = req.user._id;

    if (!chatId || typeof chatId !== "string" || chatId.length > 64) {
      return res.status(400).json({ error: "Invalid chat id" });
    }

    const user = await User.findById(myId).select("pinnedChats").lean();
    const current = user?.pinnedChats || [];
    const isPinned = current.includes(chatId);
    const next = isPinned
      ? current.filter((id) => id !== chatId)
      : [...current, chatId].slice(0, 20);

    await User.findByIdAndUpdate(myId, { $set: { pinnedChats: next } });
    res.status(200).json({ success: true, chatId, pinned: !isPinned, pinnedChats: next });
  } catch (error) {
    console.error("Error in togglePinChat:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ---- Message Reminders ("Remind me later") ----

export const createReminder = async (req, res) => {
  try {
    const { messageId, remindAt, note } = req.body;
    const userId = req.user._id;

    if (!messageId || !remindAt) {
      return res.status(400).json({ error: "messageId and remindAt are required" });
    }
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: "Invalid message id" });
    }
    const at = new Date(remindAt);
    if (isNaN(at.getTime())) {
      return res.status(400).json({ error: "Invalid reminder time" });
    }
    if (at.getTime() <= Date.now()) {
      return res.status(400).json({ error: "Reminder time must be in the future" });
    }
    if (at.getTime() - Date.now() > 365 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: "Reminder time is too far in the future" });
    }

    const message = await Message.findById(messageId)
      .select("roomId senderId receiverId isDeleted")
      .lean();
    if (!message || message.isDeleted) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Only participants of the conversation may set reminders on it
    let allowed = false;
    if (message.roomId) {
      const room = await Room.findById(message.roomId).select("members").lean();
      allowed =
        !!room &&
        (room.members || []).some((m) => m.toString() === userId.toString());
    } else {
      allowed = [message.senderId?.toString(), message.receiverId?.toString()].includes(
        userId.toString()
      );
    }
    if (!allowed) {
      return res.status(403).json({ error: "You are not part of this conversation" });
    }

    const reminder = await Reminder.create({
      userId,
      messageId,
      remindAt: at,
      note: typeof note === "string" ? note.slice(0, 200) : "",
    });
    res.status(201).json(reminder);
  } catch (error) {
    console.error("Error in createReminder: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getReminders = async (req, res) => {
  try {
    const reminders = await Reminder.find({ userId: req.user._id })
      .populate({
        path: "messageId",
        populate: { path: "senderId", select: "username profilePic" },
      })
      .sort({ remindAt: 1 })
      .limit(100)
      .lean();
    res.status(200).json(reminders);
  } catch (error) {
    console.error("Error in getReminders: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const cancelReminder = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid reminder id" });
    }
    const reminder = await Reminder.findOne({ _id: id, userId: req.user._id });
    if (!reminder) {
      return res.status(404).json({ error: "Reminder not found" });
    }
    await reminder.deleteOne();
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in cancelReminder: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

let translateCache = null;

export const translateMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { targetLanguage = "en", text: clientText } = req.body;

    let textToTranslate = typeof clientText === "string" && clientText.trim() ? clientText.trim().slice(0, 2000) : null;

    if (!textToTranslate) {
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      if (!(await canAccessMessage(message, req.user._id))) {
        return res.status(403).json({ error: "Not a participant" });
      }
      textToTranslate = message.decryptedText || message.text;
    } else if (messageId && messageId !== "client") {
      // Client-supplied text for a known message still requires membership.
      const message = await Message.findById(messageId);
      if (message && !(await canAccessMessage(message, req.user._id))) {
        return res.status(403).json({ error: "Not a participant" });
      }
    }

    if (!textToTranslate || typeof textToTranslate !== "string" || !textToTranslate.trim()) {
      return res.status(400).json({ error: "No text to translate" });
    }

    // Check if text is raw encrypted JSON payload that was not decrypted on client
    if (textToTranslate.startsWith('{"iv":') || textToTranslate.startsWith('{"ciphertext":')) {
      return res.status(400).json({ error: "Encrypted message requires client decrypted text" });
    }

    const targetLang = (targetLanguage || "en").toLowerCase().slice(0, 10);
    let translatedText = "";
    let sourceLanguage = "auto";
    let engine = "server";

    // Server is fallback only (client prefers on-device). Quota-free chain:
    // 1) Google gtx endpoint (no key, generous) 2) MyMemory last resort.
    // In-memory cache avoids repeat paid/quota calls for the same message.
    const cacheKey = `${String(messageId || "client")}:${targetLang}:${String(textToTranslate).slice(0, 100)}`;
    try {
      translateCache ??= new Map();
      const hit = translateCache.get(cacheKey);
      if (hit) {
        return res.status(200).json({
          translatedText: hit.translatedText,
          originalText: textToTranslate,
          targetLanguage: targetLang,
          sourceLanguage: hit.sourceLanguage,
          engine: hit.engine,
        });
      }
    } catch {}
    const putCache = (entry) => {
      try {
        translateCache ??= new Map();
        if (translateCache.size > 500) {
          const oldest = translateCache.keys().next().value;
          translateCache.delete(oldest);
        }
        translateCache.set(cacheKey, entry);
      } catch {}
    };

    // Attempt primary Google gtx endpoint (no key required)
    try {
      const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(textToTranslate.slice(0, 2000))}`;
      const gtxRes = await fetch(gtxUrl, { signal: AbortSignal.timeout(8000) });
      if (gtxRes.ok) {
        const gtxData = await gtxRes.json();
        const joined = Array.isArray(gtxData?.[0])
          ? gtxData[0].map((seg) => seg?.[0] || "").join("")
          : "";
        const detected = gtxData?.[2] || "auto";
        if (joined && joined.trim()) {
          translatedText = joined;
          sourceLanguage = detected;
          engine = "server-gtx";
          putCache({ translatedText, sourceLanguage, engine });
          return res.status(200).json({
            translatedText,
            originalText: textToTranslate,
            targetLanguage: targetLang,
            sourceLanguage
            , engine
          });
        }
      }
      throw new Error("gtx empty");
    } catch (gtxErr) {
      console.warn("gtx translate failed, trying npm package:", gtxErr?.message);
      // Attempt npm package
      try {
        const { translate } = await import('@vitalets/google-translate-api');
        const result = await translate(textToTranslate, { to: targetLang });
        translatedText = result.text;
        sourceLanguage = result.raw?.src || "auto";
        engine = "server";
      } catch (googleErr) {
        console.warn("Package translate failed, trying MyMemory fallback:", googleErr.message);
        // Fallback to free MyMemory API
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=Autodetect|${encodeURIComponent(targetLang)}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const data = await response.json();
        const candidate = data?.responseData?.translatedText;
        // MyMemory returns quota warnings inside translatedText — never show those as a translation.
        if (candidate && !/^MYMEMORY WARNING/i.test(candidate)) {
          translatedText = candidate;
          sourceLanguage = data.responseData.detectedLanguage || "auto";
          engine = "server-mymemory";
        } else {
          throw new Error("Translation quota exceeded. Try on-device translation (Chrome/Edge) for unlimited use.");
        }
      }
    }

    putCache({ translatedText, sourceLanguage, engine });
    res.status(200).json({
      translatedText,
      originalText: textToTranslate,
      targetLanguage: targetLang,
      sourceLanguage,
      engine
    });
  } catch (error) {
    console.error("Error in translateMessage: ", error.message);
    res.status(500).json({ error: "Translation failed. Please try again." });
  }
};

// ---- Group Announcements ----

export const getAnnouncements = async (req, res) => {
  try {
    const { roomId } = req.params;
    const myId = req.user._id;
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    const { room, isMember } = await getRoomRole(roomId, myId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!isMember) return res.status(403).json({ error: "You are not a member of this room" });

    const announcements = await Message.find({
      roomId,
      isAnnouncement: true,
      isDeleted: false,
    })
      .populate("senderId", "username profilePic")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.status(200).json(announcements);
  } catch (error) {
    console.error("Error in getAnnouncements: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ---- Group Events ----

const populateEvent = (query) =>
  query
    .populate("createdBy", "username profilePic")
    .populate("rsvps.userId", "username profilePic");

export const createEvent = async (req, res) => {
  try {
    const { roomId, title, description, startsAt, endsAt, location } = req.body;
    const myId = req.user._id;
    if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ error: "Valid roomId is required" });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Event title is required" });
    }
    const start = new Date(startsAt);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: "Valid start date is required" });
    }
    let end = null;
    if (endsAt) {
      end = new Date(endsAt);
      if (isNaN(end.getTime()) || end <= start) {
        return res.status(400).json({ error: "End date must be after start date" });
      }
    }
    const { room, isMember } = await getRoomRole(roomId, myId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!isMember) return res.status(403).json({ error: "You are not a member of this room" });

    const event = await Event.create({
      roomId,
      title: title.trim().slice(0, 120),
      description: (description || "").slice(0, 1000),
      startsAt: start,
      endsAt: end,
      location: (location || "").slice(0, 200),
      createdBy: myId,
      rsvps: [{ userId: myId, status: "going" }],
    });
    const populated = await populateEvent(Event.findById(event._id)).lean();
    io.to(roomId.toString()).emit("eventCreated", { event: populated });
    res.status(201).json(populated);
  } catch (error) {
    console.error("Error in createEvent: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getEvents = async (req, res) => {
  try {
    const { roomId } = req.params;
    const myId = req.user._id;
    const includePast = req.query.includePast === "true";
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    const { room, isMember } = await getRoomRole(roomId, myId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!isMember) return res.status(403).json({ error: "You are not a member of this room" });

    const filter = { roomId, isCancelled: false };
    if (!includePast) filter.startsAt = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
    const events = await populateEvent(Event.find(filter).sort({ startsAt: 1 }).limit(100)).lean();
    res.status(200).json(events);
  } catch (error) {
    console.error("Error in getEvents: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { title, description, startsAt, endsAt, location } = req.body;
    const myId = req.user._id;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    const event = await Event.findById(eventId);
    if (!event || event.isCancelled) {
      return res.status(404).json({ error: "Event not found" });
    }
    const { room, isMember, isAdmin } = await getRoomRole(event.roomId, myId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!isMember) return res.status(403).json({ error: "You are not a member of this room" });
    const isOwner = event.createdBy.toString() === myId.toString();
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Only the organizer or admins can edit this event" });
    }
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ error: "Event title cannot be empty" });
      event.title = title.trim().slice(0, 120);
    }
    if (description !== undefined) event.description = String(description).slice(0, 1000);
    if (startsAt !== undefined) {
      const start = new Date(startsAt);
      if (isNaN(start.getTime())) return res.status(400).json({ error: "Invalid start date" });
      event.startsAt = start;
    }
    if (endsAt !== undefined) {
      if (!endsAt) {
        event.endsAt = null;
      } else {
        const end = new Date(endsAt);
        if (isNaN(end.getTime()) || end <= event.startsAt) {
          return res.status(400).json({ error: "End date must be after start date" });
        }
        event.endsAt = end;
      }
    }
    if (location !== undefined) event.location = String(location).slice(0, 200);
    await event.save();
    const populated = await populateEvent(Event.findById(event._id)).lean();
    io.to(event.roomId.toString()).emit("eventUpdated", { event: populated });
    res.status(200).json(populated);
  } catch (error) {
    console.error("Error in updateEvent: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const cancelEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const myId = req.user._id;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    const event = await Event.findById(eventId);
    if (!event || event.isCancelled) {
      return res.status(404).json({ error: "Event not found" });
    }
    const { room, isMember, isAdmin } = await getRoomRole(event.roomId, myId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!isMember) return res.status(403).json({ error: "You are not a member of this room" });
    const isOwner = event.createdBy.toString() === myId.toString();
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Only the organizer or admins can cancel this event" });
    }
    event.isCancelled = true;
    await event.save();
    io.to(event.roomId.toString()).emit("eventDeleted", { eventId: event._id, roomId: event.roomId });
    res.status(200).json({ success: true, eventId: event._id });
  } catch (error) {
    console.error("Error in cancelEvent: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const rsvpEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { status } = req.body;
    const myId = req.user._id;
    if (!["going", "maybe", "declined"].includes(status)) {
      return res.status(400).json({ error: "Status must be going, maybe, or declined" });
    }
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    const event = await Event.findById(eventId);
    if (!event || event.isCancelled) {
      return res.status(404).json({ error: "Event not found" });
    }
    const { room, isMember } = await getRoomRole(event.roomId, myId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!isMember) return res.status(403).json({ error: "You are not a member of this room" });

    const existing = event.rsvps.find((r) => r.userId.toString() === myId.toString());
    if (existing) {
      existing.status = status;
      existing.at = new Date();
    } else {
      event.rsvps.push({ userId: myId, status });
    }
    await event.save();
    const populated = await populateEvent(Event.findById(event._id)).lean();
    io.to(event.roomId.toString()).emit("eventRsvp", { event: populated });
    res.status(200).json(populated);
  } catch (error) {
    console.error("Error in rsvpEvent: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ---- Tasks ----

const taskScopeFilter = (myId, { roomId, peerId }) => {
  if (roomId) return { roomId };
  if (peerId) {
    return {
      roomId: null,
      $or: [
        { createdBy: myId, receiverId: peerId },
        { createdBy: peerId, receiverId: myId },
      ],
    };
  }
  return null;
};

const canAccessTask = async (task, myId) => {
  if (!task) return false;
  const uid = myId.toString();
  if (task.createdBy?.toString() === uid) return true;
  if ((task.assignees || []).some((a) => a.toString() === uid)) return true;
  if (task.roomId) {
    const { isMember } = await getRoomRole(task.roomId, myId);
    return isMember;
  }
  if (task.receiverId) {
    return [task.receiverId?.toString(), task.createdBy?.toString()].includes(uid);
  }
  return false;
};

const emitTask = (task, event) => {
  const payload = { task };
  if (task.roomId) {
    io.to(task.roomId.toString()).emit(event, payload);
  } else {
    const ids = [task.createdBy?.toString(), task.receiverId?.toString(), ...(task.assignees || []).map((a) => a.toString())].filter(Boolean);
    Array.from(new Set(ids)).forEach((id) => io.to(id).emit(event, payload));
  }
};

export const createTask = async (req, res) => {
  try {
    const { title, description, roomId, peerId, assignees, dueAt, priority, sourceMessageId } = req.body;
    const myId = req.user._id;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Task title is required" });
    }
    if (!roomId && !peerId) {
      return res.status(400).json({ error: "roomId or peerId is required" });
    }
    let resolvedRoom = null;
    let resolvedPeer = null;
    if (roomId) {
      if (!mongoose.Types.ObjectId.isValid(roomId)) {
        return res.status(400).json({ error: "Invalid room id" });
      }
      const { room, isMember } = await getRoomRole(roomId, myId);
      if (!room) return res.status(404).json({ error: "Room not found" });
      if (!isMember) return res.status(403).json({ error: "You are not a member of this room" });
      resolvedRoom = roomId;
    } else {
      if (!mongoose.Types.ObjectId.isValid(peerId)) {
        return res.status(400).json({ error: "Invalid peer id" });
      }
      const peer = await User.findById(peerId).select("_id").lean();
      if (!peer) return res.status(404).json({ error: "User not found" });
      resolvedPeer = peerId;
    }
    // Validate assignees are room members (room tasks) — DM tasks allow the pair
    let resolvedAssignees = [];
    if (Array.isArray(assignees) && assignees.length > 0) {
      const unique = Array.from(new Set(assignees.map(String))).slice(0, 20);
      for (const a of unique) {
        if (!mongoose.Types.ObjectId.isValid(a)) {
          return res.status(400).json({ error: "Invalid assignee id" });
        }
      }
      if (resolvedRoom) {
        const room = await Room.findById(resolvedRoom).select("members").lean();
        const memberSet = new Set((room.members || []).map((m) => m.toString()));
        for (const a of unique) {
          if (!memberSet.has(a)) {
            return res.status(400).json({ error: "Assignees must be room members" });
          }
        }
      } else {
        const allowed = new Set([myId.toString(), resolvedPeer.toString()]);
        for (const a of unique) {
          if (!allowed.has(a)) {
            return res.status(400).json({ error: "Assignees must be chat participants" });
          }
        }
      }
      resolvedAssignees = unique;
    }
    let due = null;
    if (dueAt) {
      due = new Date(dueAt);
      if (isNaN(due.getTime())) return res.status(400).json({ error: "Invalid due date" });
    }
    const prio = ["low", "medium", "high"].includes(priority) ? priority : "medium";
    const task = await Task.create({
      title: title.trim().slice(0, 300),
      description: (description || "").slice(0, 2000),
      roomId: resolvedRoom,
      receiverId: resolvedPeer,
      createdBy: myId,
      assignees: resolvedAssignees,
      dueAt: due,
      priority: prio,
      sourceMessageId: sourceMessageId && mongoose.Types.ObjectId.isValid(sourceMessageId) ? sourceMessageId : null,
    });
    const populated = await Task.findById(task._id)
      .populate("createdBy", "username profilePic")
      .populate("assignees", "username profilePic")
      .lean();
    emitTask(populated, "taskCreated");
    res.status(201).json(populated);
  } catch (error) {
    console.error("Error in createTask: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getTasks = async (req, res) => {
  try {
    const myId = req.user._id;
    const { roomId, peerId, scope, showDone } = req.query;
    const includeDone = showDone === "true" || showDone === "all";
    let filter = {};
    if (scope === "mine") {
      filter = {
        $or: [{ createdBy: myId }, { assignees: myId }],
      };
    } else if (roomId) {
      if (!mongoose.Types.ObjectId.isValid(roomId)) {
        return res.status(400).json({ error: "Invalid room id" });
      }
      const { room, isMember } = await getRoomRole(roomId, myId);
      if (!room) return res.status(404).json({ error: "Room not found" });
      if (!isMember) return res.status(403).json({ error: "You are not a member of this room" });
      filter = { roomId };
    } else if (peerId) {
      if (!mongoose.Types.ObjectId.isValid(peerId)) {
        return res.status(400).json({ error: "Invalid peer id" });
      }
      filter = taskScopeFilter(myId, { peerId });
    } else {
      return res.status(400).json({ error: "scope=mine, roomId, or peerId is required" });
    }
    if (!includeDone) filter.isDone = false;
    const tasks = await Task.find(filter)
      .populate("createdBy", "username profilePic")
      .populate("assignees", "username profilePic")
      .sort({ isDone: 1, dueAt: 1, createdAt: -1 })
      .limit(200)
      .lean();
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Error in getTasks: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const toggleTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const myId = req.user._id;
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ error: "Invalid task id" });
    }
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (!(await canAccessTask(task, myId))) {
      return res.status(403).json({ error: "You cannot access this task" });
    }
    task.isDone = !task.isDone;
    task.doneAt = task.isDone ? new Date() : null;
    await task.save();
    const populated = await Task.findById(task._id)
      .populate("createdBy", "username profilePic")
      .populate("assignees", "username profilePic")
      .lean();
    emitTask(populated, "taskUpdated");
    res.status(200).json(populated);
  } catch (error) {
    console.error("Error in toggleTask: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const myId = req.user._id;
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ error: "Invalid task id" });
    }
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });
    const isOwner = task.createdBy.toString() === myId.toString();
    let isRoomAdmin = false;
    if (task.roomId) {
      const { isAdmin } = await getRoomRole(task.roomId, myId);
      isRoomAdmin = isAdmin;
    }
    if (!isOwner && !isRoomAdmin) {
      return res.status(403).json({ error: "Only the creator or admins can delete this task" });
    }
    await task.deleteOne();
    emitTask({ _id: task._id, roomId: task.roomId, receiverId: task.receiverId }, "taskDeleted");
    res.status(200).json({ success: true, taskId: task._id });
  } catch (error) {
    console.error("Error in deleteTask: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ---- Chat Labels ----

const LABEL_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export const getLabels = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("labels chatLabels").lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    const chatLabels = {};
    if (user.chatLabels) {
      for (const [k, v] of Object.entries(user.chatLabels instanceof Map ? Object.fromEntries(user.chatLabels) : user.chatLabels)) {
        chatLabels[k] = v;
      }
    }
    res.status(200).json({ labels: user.labels || [], chatLabels });
  } catch (error) {
    console.error("Error in getLabels: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createLabel = async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Label name is required" });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if ((user.labels || []).length >= 20) {
      return res.status(400).json({ error: "Maximum 20 labels allowed" });
    }
    const cleanName = name.trim().slice(0, 30);
    if ((user.labels || []).some((l) => l.name.toLowerCase() === cleanName.toLowerCase())) {
      return res.status(400).json({ error: "A label with this name already exists" });
    }
    const cleanColor = LABEL_COLORS.includes(color) ? color : LABEL_COLORS[(user.labels || []).length % LABEL_COLORS.length];
    user.labels.push({ name: cleanName, color: cleanColor });
    await user.save();
    res.status(201).json(user.labels[user.labels.length - 1]);
  } catch (error) {
    console.error("Error in createLabel: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteLabel = async (req, res) => {
  try {
    const { labelId } = req.params;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const exists = (user.labels || []).some((l) => l._id.toString() === labelId);
    if (!exists) return res.status(404).json({ error: "Label not found" });
    user.labels = user.labels.filter((l) => l._id.toString() !== labelId);
    // Remove from all chat assignments
    if (user.chatLabels) {
      for (const [chatId, ids] of user.chatLabels.entries()) {
        const next = (ids || []).filter((id) => id !== labelId);
        if (next.length === 0) user.chatLabels.delete(chatId);
        else user.chatLabels.set(chatId, next);
      }
    }
    await user.save();
    res.status(200).json({ success: true, labelId });
  } catch (error) {
    console.error("Error in deleteLabel: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const setChatLabels = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { labelIds } = req.body;
    if (!chatId) return res.status(400).json({ error: "chatId is required" });
    if (!Array.isArray(labelIds) || labelIds.length > 5) {
      return res.status(400).json({ error: "Provide up to 5 label ids" });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const validIds = new Set((user.labels || []).map((l) => l._id.toString()));
    for (const id of labelIds) {
      if (!validIds.has(String(id))) {
        return res.status(400).json({ error: "Unknown label id" });
      }
    }
    if (!user.chatLabels) user.chatLabels = new Map();
    if (labelIds.length === 0) user.chatLabels.delete(chatId);
    else user.chatLabels.set(chatId, labelIds.map(String));
    await user.save();
    res.status(200).json({ chatId, labelIds: labelIds.map(String) });
  } catch (error) {
    console.error("Error in setChatLabels: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ---- Global Message Search ----

export const searchMessages = async (req, res) => {
  try {
    const myId = req.user._id;
    const {
      query = "",
      chatId,
      chatType,
      senderId,
      hasMedia,
      from,
      to,
      limit = "30",
    } = req.query;

    const q = String(query).slice(0, 100).trim();
    if (!q && !hasMedia && !senderId && !from && !to) {
      return res.status(400).json({ error: "Provide a search query or filter" });
    }
    const lim = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 50);

    // Scope: only conversations the user participates in
    const myRooms = await Room.find({ members: myId }).select("_id").lean();
    const myRoomIds = myRooms.map((r) => r._id);
    const scopeOr = [
      { roomId: { $in: myRoomIds } },
      { senderId: myId },
      { receiverId: myId },
    ];

    const and = [{ $or: scopeOr }, { isDeleted: false }, { isScheduled: { $ne: true } }, { hiddenFor: { $ne: myId } }];
    // Hide 1-to-1 history with blocked contacts (group messages still show)
    const meForBlock = await User.findById(myId).select("blockedUsers").lean();
    const blockedIds = [
      ...((meForBlock?.blockedUsers || []).map((id) => id.toString())),
      ...((await User.find({ blockedUsers: myId }).select("_id").lean()).map((u) => u._id.toString())),
    ].filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (blockedIds.length > 0) {
      const blockedObjIds = blockedIds.map((id) => new mongoose.Types.ObjectId(id));
      and.push({
        $or: [
          { roomId: { $ne: null } },
          { senderId: { $nin: blockedObjIds }, receiverId: { $nin: blockedObjIds } },
        ],
      });
    }
    if (q) {
      // E2EE ciphertext is opaque — match plaintext fields only
      and.push({ text: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } });
    }
    if (chatId && mongoose.Types.ObjectId.isValid(chatId)) {
      if (chatType === "room") {
        if (!myRoomIds.some((id) => id.toString() === chatId)) {
          return res.status(403).json({ error: "You are not a member of this room" });
        }
        and.push({ roomId: new mongoose.Types.ObjectId(chatId) });
      } else {
        and.push({
          $or: [
            { senderId: myId, receiverId: new mongoose.Types.ObjectId(chatId) },
            { senderId: new mongoose.Types.ObjectId(chatId), receiverId: myId },
          ],
        });
      }
    }
    if (senderId && mongoose.Types.ObjectId.isValid(senderId)) {
      and.push({ senderId: new mongoose.Types.ObjectId(senderId) });
    }
    if (hasMedia === "true" || hasMedia === true) {
      and.push({ $or: [{ image: { $ne: null } }, { audio: { $ne: null } }, { file: { $ne: null } }] });
    }
    const dateRange = {};
    if (from) {
      const f = new Date(from);
      if (!isNaN(f.getTime())) dateRange.$gte = f;
    }
    if (to) {
      const t = new Date(to);
      if (!isNaN(t.getTime())) dateRange.$lte = t;
    }
    if (Object.keys(dateRange).length > 0) and.push({ createdAt: dateRange });

    const results = await Message.find({ $and: and })
      .populate("senderId", "username profilePic")
      .populate("roomId", "name")
      .sort({ createdAt: -1 })
      .limit(lim)
      .lean();
    res.status(200).json(results);
  } catch (error) {
    console.error("Error in searchMessages: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
