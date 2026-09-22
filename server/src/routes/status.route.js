import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { uploadStatus, getStatuses, deleteStatus, viewStatus, getStatusViewers } from "../controllers/status.controller.js";

const router = express.Router();

router.post("/", protectRoute, uploadStatus);
router.get("/", protectRoute, getStatuses);
router.delete("/:statusId", protectRoute, deleteStatus);
router.post("/:statusId/view", protectRoute, viewStatus);
router.get("/:statusId/viewers", protectRoute, getStatusViewers);

export default router;
