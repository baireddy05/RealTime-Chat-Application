import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getCallHistory, clearCallHistory } from "../controllers/call.controller.js";

const router = express.Router();

router.get("/", protectRoute, getCallHistory);
router.delete("/", protectRoute, clearCallHistory);

export default router;
