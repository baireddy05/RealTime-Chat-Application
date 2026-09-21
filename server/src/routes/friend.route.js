import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getFriends,
  getFriendRequests,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportUser,
} from "../controllers/friend.controller.js";

const router = express.Router();

router.get("/", protectRoute, getFriends);
router.get("/requests", protectRoute, getFriendRequests);
router.get("/search", protectRoute, searchUsers);
router.get("/blocked", protectRoute, getBlockedUsers);

router.post("/request/:targetUserId", protectRoute, sendFriendRequest);
router.post("/accept/:requestId", protectRoute, acceptFriendRequest);
router.post("/reject/:requestId", protectRoute, rejectFriendRequest);
router.post("/block/:userId", protectRoute, blockUser);
router.delete("/block/:userId", protectRoute, unblockUser);
router.post("/report/:userId", protectRoute, reportUser);
router.delete("/:userId", protectRoute, removeFriend);

export default router;
