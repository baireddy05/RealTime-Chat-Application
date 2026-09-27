import BroadcastList from "../models/BroadcastList.model.js";
import Message from "../models/Message.model.js";
import User from "../models/User.model.js";
import mongoose from "mongoose";
import { io } from "../lib/socket.js";
import { isBlockedPair } from "./friend.controller.js";
import { isSafeUrl } from "./chat.controller.js";
import { notifyNewMessage } from "../lib/notify.js";

const MAX_RECIPIENTS = 50;

const populateList = (query) =>
  query.populate("recipients", "username profilePic status").populate("owner", "username");

export const getBroadcasts = async (req, res) => {
  try {
    const lists = await BroadcastList.find({ owner: req.user._id })
      .populate("recipients", "username profilePic status")
      .sort({ updatedAt: -1 })
      .lean();
    res.status(200).json(lists);
  } catch (error) {
    console.error("Error in getBroadcasts:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createBroadcast = async (req, res) => {
  try {
    const { name, recipientIds = [] } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "List name is required" });
    }
    const uniqueIds = [...new Set((recipientIds || []).map((id) => id?.toString()).filter(Boolean))];
    if (uniqueIds.length === 0) {
      return res.status(400).json({ error: "Add at least one recipient" });
    }
    if (uniqueIds.length > MAX_RECIPIENTS) {
      return res.status(400).json({ error: `Broadcast lists are limited to ${MAX_RECIPIENTS} recipients` });
    }
    if (!uniqueIds.every((id) => mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ error: "Invalid recipient id" });
    }
    const existing = await User.find({ _id: { $in: uniqueIds } }).select("_id").lean();
    if (existing.length !== uniqueIds.length) {
      return res.status(404).json({ error: "One or more recipients not found" });
    }

    const list = await BroadcastList.create({
      owner: req.user._id,
      name: name.trim().slice(0, 50),
      recipients: uniqueIds.filter((id) => id !== req.user._id.toString()),
    });
    const populated = await populateList(BroadcastList.findById(list._id)).lean();
    res.status(201).json(populated);
  } catch (error) {
    console.error("Error in createBroadcast:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, recipientIds } = req.body;
    const list = await BroadcastList.findOne({ _id: id, owner: req.user._id });
    if (!list) return res.status(404).json({ error: "Broadcast list not found" });

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: "List name is required" });
      list.name = name.trim().slice(0, 50);
    }
    if (recipientIds !== undefined) {
      const uniqueIds = [...new Set(recipientIds.map((rid) => rid?.toString()).filter(Boolean))];
      if (uniqueIds.length > MAX_RECIPIENTS) {
        return res.status(400).json({ error: `Broadcast lists are limited to ${MAX_RECIPIENTS} recipients` });
      }
      if (!uniqueIds.every((rid) => mongoose.Types.ObjectId.isValid(rid))) {
        return res.status(400).json({ error: "Invalid recipient id" });
      }
      list.recipients = uniqueIds.filter((rid) => rid !== req.user._id.toString());
    }
    await list.save();
    const populated = await populateList(BroadcastList.findById(list._id)).lean();
    res.status(200).json(populated);
  } catch (error) {
    console.error("Error in updateBroadcast:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    const list = await BroadcastList.findOneAndDelete({ _id: id, owner: req.user._id });
    if (!list) return res.status(404).json({ error: "Broadcast list not found" });
    res.status(200).json({ success: true, id });
  } catch (error) {
    console.error("Error in deleteBroadcast:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Send one message to every recipient as an individual DM
export const sendBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, image, audio, file, contact } = req.body;
    const senderId = req.user._id;

    if (!text && !image && !audio && !file && !contact) {
      return res.status(400).json({ error: "Message must contain text, media, file or contact" });
    }
    if (typeof text === "string" && text.length > 8000) {
      return res.status(400).json({ error: "Message text too long (max 8000 chars)" });
    }
    for (const [label, val] of [["image", image], ["audio", audio]]) {
      if (val !== undefined && val !== null && (typeof val !== "string" || val.length > 2048 || !isSafeUrl(val))) {
        return res.status(400).json({ error: `Invalid ${label} URL` });
      }
    }
    if (file !== undefined && file !== null && (typeof file !== "object" || typeof file.url !== "string" || !isSafeUrl(file.url))) {
      return res.status(400).json({ error: "Invalid file payload" });
    }

    const list = await BroadcastList.findOne({ _id: id, owner: senderId }).lean();
    if (!list) return res.status(404).json({ error: "Broadcast list not found" });
    if (!list.recipients || list.recipients.length === 0) {
      return res.status(400).json({ error: "This list has no recipients" });
    }

    let sent = 0;
    let skipped = 0;
    for (const recipientId of list.recipients) {
      if (recipientId.toString() === senderId.toString()) {
        skipped++;
        continue;
      }
      if (await isBlockedPair(senderId, recipientId)) {
        skipped++;
        continue;
      }
      const msg = new Message({
        senderId,
        receiverId: recipientId,
        text,
        image,
        audio,
        file,
        contact: contact || null,
        isForwarded: false,
        isBroadcast: true,
        // Explicit null: the schema would otherwise materialize an empty
        // poll subdocument that renders as a bogus "Select one" card.
        poll: null,
      });
      await msg.save();
      await msg.populate("senderId", "username profilePic");
      io.to(recipientId.toString()).emit("newMessage", msg);
      io.to(senderId.toString()).emit("newMessage", msg);
      // Offline recipients get push like normal DMs (fire-and-forget).
      notifyNewMessage({
        message: msg,
        senderName: msg.senderId?.username,
        receiverId: recipientId.toString(),
      }).catch(() => {});
      sent++;
    }

    res.status(201).json({ success: true, sent, skipped });
  } catch (error) {
    console.error("Error in sendBroadcast:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
