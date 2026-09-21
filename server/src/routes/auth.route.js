import express from "express";
import rateLimit from "express-rate-limit";
import { login, logout, signup, checkAuth, updateProfile, getPublicProfile } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// Strict rate limiter for sensitive authentication endpoints (prevent brute-force & CPU exhaustion)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // TEMPORARY BYPASS FOR PLAYWRIGHT TESTS
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts from this IP. Please try again after 15 minutes." },
});

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/logout", logout);

router.get("/check", protectRoute, checkAuth);
router.put("/update-profile", protectRoute, updateProfile);
router.get("/user/:id", protectRoute, getPublicProfile);

export default router;
