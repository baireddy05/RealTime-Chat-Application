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
  hideMessageForMe,
  editMessage,
  togglePinMessage,
  toggleStarMessage,
  getStarredMessages,
  previewLink,
  getScheduledMessages,
  cancelScheduledMessage,
  updateRoom,
  kickRoomMember,
  addRoomMembers,
  toggleRoomAdmin,
  getOrCreateInvite,
  revokeInvite,
  joinRoomByCode,
  leaveRoom,
  deleteRoom,
  updateLiveLocation,
  stopLiveLocation,
  getThreadReplies,
  getMessageReceipts,
  proxyDownloadFile,
  votePoll,
  viewWhisper,
  viewOnceMedia,
  toggleArchiveChat,
  togglePinChat,
  setChatPreferences,
  createReminder,
  getReminders,
  cancelReminder,
  translateMessage,
  getAnnouncements,
  createEvent,
  getEvents,
  updateEvent,
  cancelEvent,
  rsvpEvent,
  createTask,
  getTasks,
  toggleTask,
  deleteTask,
  getLabels,
  createLabel,
  deleteLabel,
  setChatLabels,
  searchMessages,
} from "../controllers/chat.controller.js";
import {
  getBroadcasts,
  createBroadcast,
  updateBroadcast,
  deleteBroadcast,
  sendBroadcast,
} from "../controllers/broadcast.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/rooms", protectRoute, getRooms);
router.post("/rooms", protectRoute, createRoom);
router.put("/rooms/:roomId", protectRoute, updateRoom);
router.delete("/rooms/:roomId/members/:userId", protectRoute, kickRoomMember);
router.post("/rooms/:roomId/members", protectRoute, addRoomMembers);
router.post("/rooms/:roomId/invite", protectRoute, getOrCreateInvite);
router.delete("/rooms/:roomId/invite", protectRoute, revokeInvite);
router.post("/rooms/join/:code", protectRoute, joinRoomByCode);
router.post("/rooms/:roomId/leave", protectRoute, leaveRoom);
router.delete("/rooms/:roomId", protectRoute, deleteRoom);
router.post("/rooms/:roomId/admins", protectRoute, toggleRoomAdmin);
router.put("/message/:messageId/location", protectRoute, updateLiveLocation);
router.post("/message/:messageId/stop-live", protectRoute, stopLiveLocation);
router.get("/preview-link", protectRoute, previewLink);
router.get("/download/file", protectRoute, proxyDownloadFile);
router.get("/scheduled/:id", protectRoute, getScheduledMessages);
router.delete("/scheduled/:messageId", protectRoute, cancelScheduledMessage);
router.get("/reminders", protectRoute, getReminders);
router.post("/reminders", protectRoute, createReminder);
router.delete("/reminders/:id", protectRoute, cancelReminder);

router.get("/starred/:id", protectRoute, getStarredMessages);
router.get("/thread/:messageId", protectRoute, getThreadReplies);
router.get("/search", protectRoute, searchMessages);

router.get("/rooms/:roomId/announcements", protectRoute, getAnnouncements);

router.post("/events", protectRoute, createEvent);
router.get("/rooms/:roomId/events", protectRoute, getEvents);
router.put("/events/:eventId", protectRoute, updateEvent);
router.delete("/events/:eventId", protectRoute, cancelEvent);
router.post("/events/:eventId/rsvp", protectRoute, rsvpEvent);

router.post("/tasks", protectRoute, createTask);
router.get("/tasks", protectRoute, getTasks);
router.post("/tasks/:taskId/toggle", protectRoute, toggleTask);
router.delete("/tasks/:taskId", protectRoute, deleteTask);

router.get("/labels", protectRoute, getLabels);
router.post("/labels", protectRoute, createLabel);
router.delete("/labels/:labelId", protectRoute, deleteLabel);
router.put("/labels/chat/:chatId", protectRoute, setChatLabels);

router.get("/broadcasts", protectRoute, getBroadcasts);
router.post("/broadcasts", protectRoute, createBroadcast);
router.put("/broadcasts/:id", protectRoute, updateBroadcast);
router.delete("/broadcasts/:id", protectRoute, deleteBroadcast);
router.post("/broadcasts/:id/send", protectRoute, sendBroadcast);

router.get("/:id", protectRoute, getMessages);

router.post("/send", protectRoute, sendMessage);
router.post("/send/:id", protectRoute, sendMessage);

router.post("/:messageId/react", protectRoute, reactToMessage);
router.post("/:messageId/vote", protectRoute, votePoll);
router.post("/:messageId/whisper", protectRoute, viewWhisper);
router.post("/message/:messageId/view-once", protectRoute, viewOnceMedia);
router.post("/:id/read", protectRoute, markMessagesAsRead);

router.put("/message/:messageId", protectRoute, editMessage);
router.delete("/message/:messageId", protectRoute, deleteMessage);
router.post("/message/:messageId/hide", protectRoute, hideMessageForMe);
router.post("/message/:messageId/pin", protectRoute, togglePinMessage);
router.post("/message/:messageId/star", protectRoute, toggleStarMessage);
router.post("/message/:messageId/translate", protectRoute, translateMessage);
router.get("/message/:messageId/receipts", protectRoute, getMessageReceipts);

router.post("/archive/:id", protectRoute, toggleArchiveChat);
router.post("/pin/:chatId", protectRoute, togglePinChat);
router.put("/preferences/:chatId", protectRoute, setChatPreferences);

export default router;
