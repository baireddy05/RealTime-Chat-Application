import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getPushConfig,
  subscribePush,
  unsubscribePush,
  registerDeviceToken,
  unregisterDeviceToken,
} from "../controllers/push.controller.js";

const router = express.Router();

router.get("/config", getPushConfig);
router.post("/subscribe", protectRoute, subscribePush);
router.post("/unsubscribe", protectRoute, unsubscribePush);
router.post("/device-token", protectRoute, registerDeviceToken);
router.delete("/device-token", protectRoute, unregisterDeviceToken);

export default router;
