import express from "express";
import cors from "cors";
import { upload } from "./utils/multer.js";
import {
  chatHandler,
  uploadPdfHandler,
  getConversationHistoryHandler,
  clearConversationHandler,
} from "./controllers/chatController.js";

const app = express();

// Strict CORS configuration reading allowed frontend origins from process.env.FRONTEND_URL
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.trim().replace(/\/+$/, "");
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS policy violation: Origin "${origin}" is not allowed.`)
      );
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Health & Status Routes ---
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    app: "eideticai",
    message: "EideticAI Backend API is active",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    app: "eideticai",
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// --- Conversation Endpoints (MemorySaver with thread_id = conversationId) ---

// 1. Post message to conversation (invokes LangGraph agent with thread_id = conversationId)
app.post("/api/chat/:conversationId", chatHandler);
app.post("/api/chat", chatHandler);

// 2. Retrieve conversation history from MemorySaver
app.get("/api/chat/:conversationId/history", getConversationHistoryHandler);
app.get("/api/chat/:conversationId", getConversationHistoryHandler);

// 3. Clear conversation thread memory
app.delete("/api/chat/:conversationId", clearConversationHandler);

// 4. Upload PDF into a conversation session (chunks tagged with conversationId in Qdrant)
app.post("/api/chat/:conversationId/upload", upload.single("pdf"), uploadPdfHandler);
app.post("/api/upload-pdf", upload.single("pdf"), uploadPdfHandler);

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
