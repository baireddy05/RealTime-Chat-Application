import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { uploadStatus, getStatuses, deleteStatus } from "../controllers/status.controller.js";

const router = express.Router();

router.post("/", protectRoute, uploadStatus);
router.get("/", protectRoute, getStatuses);
router.delete("/:statusId", protectRoute, deleteStatus);

export default router;
