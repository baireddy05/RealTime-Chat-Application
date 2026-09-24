import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.model.js";
import Room from "../models/Room.model.js";
import Message from "../models/Message.model.js";

const seedInitialData = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log("[Database] Empty database detected. Seeding initial test data...");
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash("password123", salt);

      const usersData = [];
      for (let i = 1; i <= 5; i++) {
        usersData.push({
          username: `User${i}`,
          email: `user${i}@example.com`,
          password: hashedPassword,
          profilePic: `https://api.dicebear.com/7.x/avataaars/svg?seed=User${i}`,
          bio: "Hey there! I am using Pulse.",
          status: "Available",
        });
      }
      const createdUsers = await User.insertMany(usersData);

      // Link User1 and User2 as friends
      if (createdUsers.length >= 2) {
        await User.findByIdAndUpdate(createdUsers[0]._id, { $addToSet: { friends: createdUsers[1]._id } });
        await User.findByIdAndUpdate(createdUsers[1]._id, { $addToSet: { friends: createdUsers[0]._id } });
      }

      const roomsData = [
        { name: "General Group", description: "General discussions & community" },
      ];
      const createdRooms = await Room.insertMany(roomsData);

      // Seed a few initial room messages
      for (let i = 0; i < 6; i++) {
        await Message.create({
          senderId: createdUsers[i % 2]._id,
          roomId: createdRooms[0]._id,
          text: `Welcome to Pulse General Group! Message #${i + 1}`,
        });
      }
      console.log("[Database] Initial data seeded successfully.");
    }
  } catch (err) {
    console.warn("[Database] Auto-seed warning:", err.message);
  }
};

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 30000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await seedInitialData();
  } catch (error) {
    // Never fall back to an ephemeral in-memory DB in production — that would
    // silently lose all data and seed well-known test credentials.
    if (process.env.NODE_ENV === "production") {
      console.error(`[Database] MongoDB connection failed in production — refusing in-memory fallback: ${error.message}`);
      throw error;
    }
    console.warn(`[Database] MongoDB Atlas connection failed (${error.message}).`);
    console.warn(`[Database] Starting embedded resilient database fallback...`);
    try {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      console.log(`[Database] Embedded resilient database active on ${uri}`);
      await seedInitialData();
    } catch (fallbackError) {
      console.error("[Database] Fallback database failed:", fallbackError.message);
    }
  }
};
