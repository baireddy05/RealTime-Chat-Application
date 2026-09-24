import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
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

// Keep-Alive & Health Check Endpoints for Cronjobs / Monitoring / Uptime Checkers
// Placed before CORS to ensure external cron services (cron-job.org, UptimeRobot, Render keep-alive)
// always receive 200 OK without any origin or header restrictions.
const healthResponse = (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: "ok",
    service: "Pulse Chat Backend",
    message: "Pulse Chat API is active and running ⚡",
    uptime: Math.floor(process.uptime()),
    database: isDbConnected ? "connected" : "connecting",
    timestamp: new Date().toISOString(),
  });
};

app.all("/", healthResponse);
app.all(["/health", "/api/health", "/ping"], healthResponse);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(cors(corsOptions));

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/statuses", statusRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/push", pushRoutes);

// Global Error Handler to catch any unhandled route errors gracefully
app.use((err, req, res, next) => {
  console.error("[Server Error]", err.message || err);
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    status: "error",
    error: err.name || "Error",
    message: err.message || "An unexpected server error occurred",
  });
});

import { startMessageScheduler } from "./lib/messageScheduler.js";

server.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server is running on PORT ${PORT}`);
  await connectDB();
  startMessageScheduler();
});
