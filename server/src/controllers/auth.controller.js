import { generateToken } from "../lib/utils.js";
import User from "../models/User.model.js";
import Room from "../models/Room.model.js";
import PasswordReset from "../models/PasswordReset.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import mongoose from "mongoose";
import { io } from "../lib/socket.js";
import { sendOtpEmail } from "../lib/email.js";

export const signup = async (req, res) => {
  const { username, email, password } = req.body || {};
  try {
    if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "All fields are required" });
    }
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanUsername || !cleanEmail || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (cleanUsername.length < 3 || cleanUsername.length > 30 || !/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      return res.status(400).json({ message: "Invalid username" });
    }
    if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ message: "Password must be 6-128 characters" });
    }

    const userEmail = await User.findOne({ email: cleanEmail }).collation({ locale: "en", strength: 2 }).select("_id").lean();
    const userUsername = await User.findOne({ username: cleanUsername }).collation({ locale: "en", strength: 2 }).select("_id").lean();

    if (userEmail) return res.status(400).json({ message: "Email already exists" });
    if (userUsername) return res.status(400).json({ message: "Username already exists" });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
    });

    if (newUser) {
      await newUser.save();
      const token = generateToken(newUser._id, res);
      res.status(201).json({
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        profilePic: newUser.profilePic,
        bio: newUser.bio,
        status: newUser.status,
        token,
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body || {};
  try {
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return res.status(401).json({ message: "Invalid email/username or password" });
    }
    if (password.length > 128 || email.length > 254) {
      return res.status(401).json({ message: "Invalid email/username or password" });
    }

    const trimmed = email.trim();
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const user = await User.findOne({
      $or: [
        { email: trimmed.toLowerCase() },
        { username: new RegExp(`^${escaped}$`, "i") },
      ],
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email/username or password" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email/username or password" });
    }

    const token = generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePic: user.profilePic,
      bio: user.bio,
      status: user.status,
      token,
    });
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("jwt", "", {
      maxAge: 0,
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const checkAuth = (req, res) => {
  try {
    // Token itself stays httpOnly — never echo secrets in body.
    res.status(200).json(req.user.toObject ? req.user.toObject() : req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Public contact profile for the WhatsApp-style contact info view:
// identity, presence text, friendship/block state and shared groups.
export const getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const myId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findById(id)
      .select("username profilePic bio status friends blockedUsers")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    // Blocked contacts (either direction) get no profile details
    const blockedPair = await User.findOne({
      $or: [
        { _id: myId, blockedUsers: id },
        { _id: id, blockedUsers: myId },
      ],
    })
      .select("_id")
      .lean();
    if (blockedPair) {
      return res.status(403).json({ message: "Profile unavailable" });
    }

    const myRooms = await Room.find({ members: { $all: [myId, id] } })
      .select("name avatar")
      .lean();

    const isSelf = myId.toString() === id.toString();
    res.status(200).json({
      _id: user._id,
      username: user.username,
      profilePic: user.profilePic,
      bio: user.bio,
      status: user.status,
      isSelf,
      isFriend: (user.friends || []).some((f) => f.toString() === myId.toString()),
      sharedGroups: (myRooms || []).map((r) => ({
        _id: r._id,
        name: r.name,
        avatar: r.avatar,
      })),
    });
  } catch (error) {
    console.log("Error in getPublicProfile controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { username, profilePic, bio, status, readReceipts, chatPreferences } = req.body || {};
    const userId = req.user._id;

    let cleanUsername;
    if (username !== undefined) {
      if (typeof username !== "string" || username.trim().length < 3 || username.trim().length > 30 || !/^[a-zA-Z0-9_.-]+$/.test(username.trim())) {
        return res.status(400).json({ message: "Invalid username" });
      }
      cleanUsername = username.trim();
      const existingUser = await User.findOne({ username: cleanUsername, _id: { $ne: userId } }).select("_id").lean();
      if (existingUser) {
        return res.status(400).json({ message: "Username is already taken" });
      }
    }
    if (profilePic !== undefined && (typeof profilePic !== "string" || profilePic.length > 2048)) {
      return res.status(400).json({ message: "Invalid profile picture" });
    }
    if (bio !== undefined && (typeof bio !== "string" || bio.length > 300)) {
      return res.status(400).json({ message: "Bio too long (max 300 chars)" });
    }
    if (status !== undefined && (typeof status !== "string" || status.length > 140)) {
      return res.status(400).json({ message: "Status too long (max 140 chars)" });
    }
    if (readReceipts !== undefined && typeof readReceipts !== "boolean") {
      return res.status(400).json({ message: "Invalid readReceipts value" });
    }
    if (chatPreferences !== undefined) {
      const size = (() => {
        try {
          return JSON.stringify(chatPreferences).length;
        } catch {
          return Infinity;
        }
      })();
      if (size > 20000) {
        return res.status(400).json({ message: "Chat preferences too large" });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        ...(cleanUsername && { username: cleanUsername }),
        ...(profilePic !== undefined && { profilePic }),
        ...(bio !== undefined && { bio }),
        ...(status !== undefined && { status }),
        ...(readReceipts !== undefined && { readReceipts }),
        ...(chatPreferences !== undefined && { chatPreferences }),
      },
      { new: true }
    ).select("-password").lean();

    if (io) {
      // Scoped fan-out only: friends + self receive a STRIPPED profile.
      // Broadcasting the full doc leaks email/friends/blockedUsers/preferences.
      try {
        const me = await User.findById(userId).select("friends").lean();
        const audience = new Set([(me?.friends || []).map((f) => f.toString()), userId.toString()].flat());
        const stripped = {
          _id: updatedUser._id,
          username: updatedUser.username,
          profilePic: updatedUser.profilePic,
          status: updatedUser.status,
          bio: updatedUser.bio,
        };
        audience.forEach((id) => {
          if (id) io.to(id).emit("userUpdated", stripped);
        });
      } catch {}
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("Error in updateProfile controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * Step 1: Request OTP code for password reset
 */
export const forgotPassword = async (req, res) => {
  try {
    const { identifier } = req.body || {};
    if (!identifier || typeof identifier !== "string" || !identifier.trim()) {
      return res.status(400).json({ message: "Please provide your email or username." });
    }

    const cleanInput = identifier.trim();
    const escaped = cleanInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const user = await User.findOne({
      $or: [
        { email: cleanInput.toLowerCase() },
        { username: new RegExp(`^${escaped}$`, "i") },
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "No account found with this email or username." });
    }

    // Rate-limit check: cooldown of 60 seconds between OTP requests for the same email
    const existingReset = await PasswordReset.findOne({ email: user.email });
    if (existingReset) {
      const secondsSinceLast = (Date.now() - new Date(existingReset.updatedAt || existingReset.createdAt).getTime()) / 1000;
      if (secondsSinceLast < 60) {
        const waitSeconds = Math.ceil(60 - secondsSinceLast);
        return res.status(429).json({
          message: `Please wait ${waitSeconds}s before requesting a new OTP.`,
          retryAfter: waitSeconds,
        });
      }
    }

    // Generate 6-digit cryptographic numeric OTP
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(rawOtp, salt);

    // 10-minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Overwrite existing OTP record for this email
    await PasswordReset.deleteMany({ email: user.email });
    await PasswordReset.create({
      email: user.email,
      otp: hashedOtp,
      expiresAt,
      attempts: 0,
    });

    // Send email asynchronously in the background so the HTTP response returns immediately (< 50ms)
    sendOtpEmail({
      to: user.email,
      username: user.username,
      otp: rawOtp,
    }).catch((err) => {
      console.error("[Email Service] Asynchronous send error:", err.message);
    });

    const [localPart, domain] = user.email.split("@");
    const maskedLocal =
      localPart.length <= 2
        ? localPart[0] + "*"
        : localPart[0] + "*".repeat(Math.max(1, localPart.length - 2)) + localPart[localPart.length - 1];
    const maskedEmail = `${maskedLocal}@${domain}`;

    const hasSmtp = Boolean(process.env.SMTP_USER || process.env.EMAIL_USER);
    const isProduction = process.env.NODE_ENV === "production";

    res.status(200).json({
      message: hasSmtp
        ? "Verification code sent to your registered email address."
        : "Verification code generated! (Check server console or use the code below)",
      email: user.email,
      maskedEmail,
      hasSmtp,
      ...(!hasSmtp && !isProduction && { devOtp: rawOtp }),
    });
  } catch (error) {
    console.error("Error in forgotPassword controller:", error.message);
    res.status(500).json({ message: "Failed to send reset code. Please try again." });
  }
};

/**
 * Step 2: Verify OTP code before allowing password reset
 */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp || typeof email !== "string" || typeof otp !== "string") {
      return res.status(400).json({ message: "Email and OTP code are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    const resetRecord = await PasswordReset.findOne({ email: cleanEmail });
    if (!resetRecord || new Date() > new Date(resetRecord.expiresAt)) {
      return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
    }

    if (resetRecord.attempts >= 5) {
      await PasswordReset.deleteOne({ _id: resetRecord._id });
      return res.status(429).json({ message: "Too many incorrect attempts. Please request a new verification code." });
    }

    const isMatch = await bcrypt.compare(cleanOtp, resetRecord.otp);
    if (!isMatch) {
      resetRecord.attempts = (resetRecord.attempts || 0) + 1;
      await resetRecord.save();
      const remaining = 5 - resetRecord.attempts;
      return res.status(400).json({
        message: remaining > 0
          ? `Invalid code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Invalid code. Maximum attempts reached.",
      });
    }

    res.status(200).json({
      message: "Code verified successfully.",
      valid: true,
    });
  } catch (error) {
    console.error("Error in verifyOtp controller:", error.message);
    res.status(500).json({ message: "Verification failed. Please try again." });
  }
};

/**
 * Step 3: Complete password reset with verified OTP and new password
 */
export const resetPasswordWithOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};
    if (
      !email ||
      !otp ||
      !newPassword ||
      typeof email !== "string" ||
      typeof otp !== "string" ||
      typeof newPassword !== "string"
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ message: "Password must be 6-128 characters long." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    const resetRecord = await PasswordReset.findOne({ email: cleanEmail });
    if (!resetRecord || new Date() > new Date(resetRecord.expiresAt)) {
      return res.status(400).json({ message: "Verification code has expired. Please request a new code." });
    }

    if (resetRecord.attempts >= 5) {
      await PasswordReset.deleteOne({ _id: resetRecord._id });
      return res.status(429).json({ message: "Too many incorrect attempts. Please request a new verification code." });
    }

    const isMatch = await bcrypt.compare(cleanOtp, resetRecord.otp);
    if (!isMatch) {
      resetRecord.attempts = (resetRecord.attempts || 0) + 1;
      await resetRecord.save();
      return res.status(400).json({ message: "Invalid verification code." });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ message: "User account not found." });
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    // Invalidate the reset record immediately
    await PasswordReset.deleteOne({ _id: resetRecord._id });

    res.status(200).json({
      message: "Password has been reset successfully! You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Error in resetPasswordWithOtp controller:", error.message);
    res.status(500).json({ message: "Failed to reset password. Please try again." });
  }
};

/**
 * Ultra-lightweight micro-page to copy OTP to clipboard without opening the main web app
 */
export const copyOtpPage = (req, res) => {
  const { code } = req.query || {};
  const cleanCode = (code || "").toString().replace(/[^0-9]/g, "").slice(0, 6);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pulse - Code Copied</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0b0f19;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: linear-gradient(180deg, #131b2e 0%, #0d121f 100%);
      border: 1px solid #1e293b;
      border-radius: 20px;
      padding: 32px 26px;
      max-width: 360px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #10b981;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 14px;
    }
    .code-box {
      background: #070c18;
      border: 1px dashed rgba(0, 240, 255, 0.35);
      border-radius: 14px;
      padding: 16px 20px;
      font-family: "Courier New", Courier, monospace;
      font-size: 36px;
      font-weight: 900;
      letter-spacing: 8px;
      color: #00f0ff;
      margin: 12px 0 16px 0;
      text-shadow: 0 0 16px rgba(0, 240, 255, 0.35);
    }
    .hint {
      color: #94a3b8;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .btn {
      background: #1e293b;
      color: #f3f4f6;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 10px 22px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { background: #334155; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">✓ Copied to Clipboard!</div>
    <div class="code-box">${cleanCode || "------"}</div>
    <p class="hint">Code copied! Switch back to your Pulse tab and paste it.</p>
    <button class="btn" onclick="window.close()">Close</button>
  </div>
  <script>
    const code = "${cleanCode}";
    if (code && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        setTimeout(() => { try { window.close(); } catch(e){} }, 1800);
      }).catch(() => {});
    }
  </script>
</body>
</html>`);
};
