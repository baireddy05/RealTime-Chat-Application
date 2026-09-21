import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import { protectRoute } from "../middleware/auth.middleware.js";
import cloudinary from "../lib/cloudinary.js";
import Message from "../models/Message.model.js";

const router = express.Router();

// In-memory staging for document uploads (streamed straight into GridFS,
// never written to disk — safe for ephemeral hosting filesystems)
const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Document types we are willing to store & serve. Executables, scripts and
// HTML/SVG (XSS vectors when served inline) are rejected.
const ALLOWED_DOC_MIMES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "text/plain",
  "text/csv",
  "application/rtf",
  "text/rtf",
]);

const ALLOWED_DOC_EXTS = new Set([
  ".pdf", ".zip", ".rar", ".7z", ".doc", ".docx", ".xls", ".xlsx",
  ".ppt", ".pptx", ".odt", ".ods", ".odp", ".txt", ".csv", ".rtf",
]);

// Canonical MIME by extension. Never trust the client-claimed part type
// alone (multipart parsers may report it as octet-stream).
const EXT_TO_MIME = {
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".rar": "application/x-rar-compressed",
  ".7z": "application/x-7z-compressed",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".rtf": "application/rtf",
};

const bucket = () =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "pulse_docs" });

router.get("/signature", protectRoute, async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
      },
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
      timestamp,
      signature,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
    });
  } catch (error) {
    console.log("Error in getSignature controller", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Upload a document (PDF/ZIP/Office/txt). Documents live in our own GridFS
// store instead of Cloudinary because document delivery is restricted there
// (401s) — this endpoint works on any plan and keeps files private to chats.
router.post("/document", protectRoute, (req, res) => {
  uploadDoc.single("file")(req, res, async (err) => {
    try {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ error: "File too large (50MB max)" });
        }
        return res.status(400).json({ error: "Invalid upload" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No file received" });
      }

      const originalName = (req.file.originalname || "document").slice(0, 150);
      const ext = originalName.includes(".")
        ? originalName.slice(originalName.lastIndexOf(".")).toLowerCase()
        : "";
      const mime = req.file.mimetype || "application/octet-stream";
      if (!ALLOWED_DOC_MIMES.has(mime) && !ALLOWED_DOC_EXTS.has(ext)) {
        return res.status(415).json({ error: `File type not allowed (${ext || mime})` });
      }

      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext || ""}`;
      const resolvedType = EXT_TO_MIME[ext] || mime;
      const uploadStream = bucket().openUploadStream(filename, {
        // NOTE: contentType is ALSO mirrored into metadata because some
        // driver versions silently drop the top-level files.contentType.
        contentType: resolvedType,
        metadata: {
          originalName,
          contentType: resolvedType,
          owner: req.user._id.toString(),
          size: req.file.size,
          uploadedAt: new Date(),
        },
      });

      uploadStream.on("error", (streamErr) => {
        console.log("Error storing document", streamErr.message);
        if (!res.headersSent) res.status(500).json({ error: "Failed to store file" });
      });
      uploadStream.on("finish", () => {
        const fileId = uploadStream.id.toString();
        const base = `${req.protocol}://${req.get("host")}`;
        res.status(201).json({
          fileId,
          url: `${base}/api/upload/file/${fileId}`,
          name: originalName,
          size: req.file.size,
          fileType: mime,
        });
      });
      uploadStream.end(req.file.buffer);
    } catch (error) {
      console.log("Error in document upload controller", error.message);
      if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
    }
  });
});

// Stream a stored document back as an attachment. Only participants of a
// conversation containing the file may download it.
router.get("/file/:id", protectRoute, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid file id" });
    }
    const myId = req.user._id.toString();

    const files = await mongoose.connection.db
      .collection("pulse_docs.files")
      .findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!files) return res.status(404).json({ error: "File not found" });

    const fileUrl = `${req.protocol}://${req.get("host")}/api/upload/file/${id}`;
    const msg = await Message.findOne({ "file.url": fileUrl })
      .select("senderId receiverId roomId")
      .lean();
    // Orphan uploads (never sent) are downloadable by their owner
    let allowed = files.metadata?.owner === myId;
    if (!allowed && msg) {
      if (msg.roomId) {
        const Room = (await import("../models/Room.model.js")).default;
        const room = await Room.findById(msg.roomId).select("members").lean();
        allowed = !!room && (room.members || []).some((m) => m.toString() === myId);
      } else {
        allowed = [msg.senderId?.toString(), msg.receiverId?.toString()].includes(myId);
      }
    }
    if (!allowed) {
      return res.status(403).json({ error: "You don't have access to this file" });
    }

    const originalName = files.metadata?.originalName || "document";
    const safeName = originalName.replace(/[\r\n"\\/<>:|?*]/g, "_");
    res.setHeader("Content-Type", files.metadata?.contentType || files.contentType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`
    );
    res.setHeader("X-Content-Type-Options", "nosniff");

    const downloadStream = bucket().openDownloadStream(new mongoose.Types.ObjectId(id));
    downloadStream.on("error", () => {
      if (!res.headersSent) res.status(404).json({ error: "File not found" });
      else res.end();
    });
    downloadStream.pipe(res);
  } catch (error) {
    console.log("Error streaming document", error.message);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
