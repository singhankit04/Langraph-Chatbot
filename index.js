import express from "express";
import cors from "cors";
import { upload, ingestPdfBuffer } from "./backend/rag/index.js";

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API Entrypoints / Routes ---

// Health & Status Routes
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

// 1. PDF Upload & Ingest Entrypoint (uses multer)
app.post("/api/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded. Please upload a PDF using the form-data key 'pdf'.",
      });
    }

    // Ingest the in-memory buffer straight into Qdrant
    const result = await ingestPdfBuffer(req.file.buffer, req.file.originalname);

    res.json({
      message: `Successfully ingested "${req.file.originalname}" into Qdrant!`,
      source: result.source,
      pages: result.pagesCount,
      chunks: result.chunksCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Chat / Query Entrypoint
app.post("/api/chat", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: "A valid 'question' field is required." });
    }

    res.json({
      message: "Query received",
      question: question.trim(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
