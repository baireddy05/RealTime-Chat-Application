import express from "express";
import rateLimit from "express-rate-limit";
import {
  login,
  logout,
  signup,
  checkAuth,
  updateProfile,
  getPublicProfile,
  forgotPassword,
  verifyOtp,
  resetPasswordWithOtp,
  copyOtpPage,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// Strict rate limiter for sensitive authentication endpoints (prevent brute-force & CPU exhaustion)
const isTestEnv = process.env.NODE_ENV === "test" || process.env.PLAYWRIGHT === "1";
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 1000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts from this IP. Please try again after 15 minutes." },
});

// Password recovery endpoints
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/verify-otp", authLimiter, verifyOtp);
router.post("/reset-password", authLimiter, resetPasswordWithOtp);
router.get("/copy-code", copyOtpPage);

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/logout", logout);

router.get("/check", protectRoute, checkAuth);
router.put("/update-profile", protectRoute, updateProfile);
router.get("/user/:id", protectRoute, getPublicProfile);

export default router;
