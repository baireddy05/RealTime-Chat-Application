import { generateToken } from "../lib/utils.js";
import User from "../models/User.model.js";
import bcrypt from "bcryptjs";
import { io } from "../lib/socket.js";

export const signup = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const userEmail = await User.findOne({ email }).select("_id").lean();
    const userUsername = await User.findOne({ username }).select("_id").lean();

    if (userEmail) return res.status(400).json({ message: "Email already exists" });
    if (userUsername) return res.status(400).json({ message: "Username already exists" });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email: email.toLowerCase().trim(),
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
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Please enter your email or username and password" });
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
      return res.status(400).json({ message: "Invalid email/username or password" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid email/username or password" });
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
    const token = req.cookies.jwt || req.headers.authorization?.replace("Bearer ", "");
    res.status(200).json({
      ...(req.user.toObject ? req.user.toObject() : req.user),
      token,
    });
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { username, profilePic, bio, status, readReceipts, chatPreferences } = req.body;
    const userId = req.user._id;

    if (username) {
      const existingUser = await User.findOne({ username, _id: { $ne: userId } }).select("_id").lean();
      if (existingUser) {
        return res.status(400).json({ message: "Username is already taken" });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        ...(username && { username }),
        ...(profilePic !== undefined && { profilePic }),
        ...(bio !== undefined && { bio }),
        ...(status !== undefined && { status }),
        ...(readReceipts !== undefined && { readReceipts }),
        ...(chatPreferences !== undefined && { chatPreferences }),
      },
      { new: true }
    ).select("-password").lean();

    if (io) {
      io.emit("userUpdated", updatedUser);
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("Error in updateProfile controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
