import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./src/models/User.model.js";
import Room from "./src/models/Room.model.js";
import Message from "./src/models/Message.model.js";
import { connectDB } from "./src/lib/db.js";

dotenv.config();

const seedDB = async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    // Clear existing data
    await User.deleteMany({});
    await Room.deleteMany({});
    await Message.deleteMany({});
    console.log("Database cleared");

    // Create 5 Mock Users
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash("password123", salt);
    
    const usersData = [];
    for (let i = 1; i <= 5; i++) {
      usersData.push({
        username: `User${i}`,
        email: `user${i}@example.com`,
        password: hashedPassword,
        profilePic: `https://api.dicebear.com/7.x/avataaars/svg?seed=User${i}`,
      });
    }

    const createdUsers = await User.insertMany(usersData);
    console.log("Users seeded successfully");

    // Create 3 Public Rooms
    const roomsData = [
      { name: "#general", description: "General discussions" },
      { name: "#announcements", description: "Important updates" },
      { name: "#dev-hangout", description: "Talk about code" },
    ];

    const createdRooms = await Room.insertMany(roomsData);
    console.log("Rooms seeded successfully");

    // Create Messages
    const messagesData = [];
    
    // Create some Room messages
    for (let i = 0; i < 25; i++) {
      messagesData.push({
        senderId: createdUsers[Math.floor(Math.random() * createdUsers.length)]._id,
        roomId: createdRooms[Math.floor(Math.random() * createdRooms.length)]._id,
        text: `Room message ${i + 1} for testing!`,
      });
    }

    // Create some Direct Messages
    for (let i = 0; i < 25; i++) {
      const sender = createdUsers[Math.floor(Math.random() * createdUsers.length)];
      let receiver = createdUsers[Math.floor(Math.random() * createdUsers.length)];
      while (receiver._id === sender._id) {
        receiver = createdUsers[Math.floor(Math.random() * createdUsers.length)];
      }

      messagesData.push({
        senderId: sender._id,
        receiverId: receiver._id,
        text: `Direct message ${i + 1} between ${sender.username} and ${receiver.username}.`,
      });
    }

    await Message.insertMany(messagesData);
    console.log("50+ Messages seeded successfully");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding database: ", error);
    process.exit(1);
  }
};

seedDB();
