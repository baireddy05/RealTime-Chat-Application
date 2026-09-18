import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getMessages,
  getRooms,
  createRoom,
  getUsersForSidebar,
  sendMessage,
  reactToMessage,
  markMessagesAsRead,
  deleteMessage,
  editMessage,
  togglePinMessage,
  toggleStarMessage,
  getStarredMessages,
  previewLink,
  getScheduledMessages,
  cancelScheduledMessage,
  updateRoom,
  kickRoomMember,
  toggleRoomAdmin,
  getThreadReplies,
  getMessageReceipts,
  proxyDownloadFile,
  votePoll,
  viewWhisper,
} from "../controllers/chat.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/rooms", protectRoute, getRooms);
router.post("/rooms", protectRoute, createRoom);
router.put("/rooms/:roomId", protectRoute, updateRoom);
router.delete("/rooms/:roomId/members/:userId", protectRoute, kickRoomMember);
router.post("/rooms/:roomId/admins", protectRoute, toggleRoomAdmin);

router.get("/preview-link", protectRoute, previewLink);
router.get("/download/file", protectRoute, proxyDownloadFile);
router.get("/scheduled/:id", protectRoute, getScheduledMessages);
router.delete("/scheduled/:messageId", protectRoute, cancelScheduledMessage);

router.get("/starred/:id", protectRoute, getStarredMessages);
router.get("/thread/:messageId", protectRoute, getThreadReplies);
router.get("/:id", protectRoute, getMessages);

router.post("/send", protectRoute, sendMessage);
router.post("/send/:id", protectRoute, sendMessage);

router.post("/:messageId/react", protectRoute, reactToMessage);
router.post("/:messageId/vote", protectRoute, votePoll);
router.post("/:messageId/whisper", protectRoute, viewWhisper);
router.post("/:id/read", protectRoute, markMessagesAsRead);

router.put("/message/:messageId", protectRoute, editMessage);
router.delete("/message/:messageId", protectRoute, deleteMessage);
router.post("/message/:messageId/pin", protectRoute, togglePinMessage);
router.post("/message/:messageId/star", protectRoute, toggleStarMessage);
router.get("/message/:messageId/receipts", protectRoute, getMessageReceipts);

export default router;
