import express from "express";
import cors from "cors";
import { upload, uploadDisk } from "./utils/multer.js";
import {
  uploadPdfHandler,
  queuePdfHandler,
  getPdfJobStatusHandler,
} from "./controllers/pdfController.js";
import { chatHandler } from "./controllers/chatController.js";

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Health & Status Routes ---
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "API service is active",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// --- API Entrypoints ---

// 1. PDF Upload (Synchronous: in-memory buffer)
app.post("/api/upload-pdf", upload.single("pdf"), uploadPdfHandler);

// 2. PDF Upload via Queue (Asynchronous: disk storage in backend/uploads/ + BullMQ worker)
app.post("/api/upload-pdf/queue", uploadDisk.single("pdf"), queuePdfHandler);

// 3. Queue Job Status Polling
app.get("/api/upload-status/:jobId", getPdfJobStatusHandler);

// 4. Chat / Query Ingestion
app.post("/api/chat", chatHandler);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("API Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

export default app;
