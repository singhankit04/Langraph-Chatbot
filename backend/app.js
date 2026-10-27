import express from "express";
import cors from "cors";
import { upload } from "./utils/multer.js";
import { chatHandler, uploadPdfHandler } from "./controllers/chatController.js";

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Health & Status Routes ---
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "LangGraph RAG & Agentic Chatbot API is active",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// --- Chat Session Endpoints (Isolated by :chatId) ---

// 1. Post chat message to a session (RAG + Chatbot with isolated memory)
app.post("/api/chat/:chatId", chatHandler);
app.post("/api/chat", chatHandler); // Fallback if client omits chatId

// 2. Upload PDF into a session (chunks tagged with chatId in Qdrant)
app.post("/api/chat/:chatId/upload", upload.single("pdf"), uploadPdfHandler);
app.post("/api/upload-pdf", upload.single("pdf"), uploadPdfHandler); // Backwards compatibility fallback

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
