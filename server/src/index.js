import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./lib/db.js";
import { app, server } from "./lib/socket.js";

import authRoutes from "./routes/auth.route.js";
import chatRoutes from "./routes/chat.route.js";
import uploadRoutes from "./routes/upload.route.js";
import friendRoutes from "./routes/friend.route.js";
import statusRoutes from "./routes/status.route.js";
import callRoutes from "./routes/call.route.js";
import pushRoutes from "./routes/push.route.js";

const PORT = process.env.PORT || 5000;

import { corsOptions } from "./lib/corsConfig.js";

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.set("etag", "strong");
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(cors(corsOptions));

// Keep-Alive & Health Check Endpoints for Cronjobs / Monitoring
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Pulse Chat Backend",
    message: "Pulse Chat API is active and running ⚡",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get(["/health", "/api/health", "/ping"], (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "pong",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/statuses", statusRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/push", pushRoutes);

import { startMessageScheduler } from "./lib/messageScheduler.js";

server.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server is running on PORT ${PORT}`);
  await connectDB();
  startMessageScheduler();
});
