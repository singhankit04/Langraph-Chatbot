import express from "express";
import cors from "cors";
import { upload } from "./utils/multer.js";
import {
  chatHandler,
  uploadPdfHandler,
  getConversationHistoryHandler,
  clearConversationHandler,
  getJobStatusHandler,
  getDlqJobsHandler,
  getDlqJobDetailsHandler,
  retryDlqJobHandler,
  removeDlqJobHandler,
  clearDlqHandler,
} from "./controllers/chatController.js";

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL)
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin.trim().replace(/\/+$/, ""))) {
        return callback(null, true);
      }
      return callback(new Error(`CORS violation: Origin "${origin}" not allowed.`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health & Status Routes
app.get("/", (req, res) => res.json({ status: "ok", app: "eideticai" }));
app.get("/api/health", (req, res) => {
  res.json({ app: "eideticai", status: "healthy", uptime: process.uptime() })
})
 


// Chat & Conversation Routes
app.post("/api/chat/:conversationId", chatHandler);
app.post("/api/chat", chatHandler);
app.get("/api/chat/:conversationId/history", getConversationHistoryHandler);
app.get("/api/chat/:conversationId", getConversationHistoryHandler);
app.delete("/api/chat/:conversationId", clearConversationHandler);

// PDF Ingestion Routes
app.post("/api/chat/:conversationId/upload", upload.single("pdf"), uploadPdfHandler);
app.post("/api/upload-pdf", upload.single("pdf"), uploadPdfHandler);



// DLQ Admin Authentication Middleware
app.use("/api/jobs/dlq", (req, res, next) => {
  const expectedAdmin = process.env.ADMIN;
  const expectedPassword = process.env.PASSWORD;

  // Fail-closed if credentials are not configured in .env
  if (!expectedAdmin || !expectedPassword) {
    return res.status(500).json({ error: "Admin credentials are not configured on the server." });
  }

  // 1. Check req.body (for POST / DELETE)
  // 2. Fallback to headers or query (for GET requests)
  const admin = req.body?.admin || req.headers?.["admin"] || req.query?.admin;
  const password = req.body?.password || req.headers?.["password"] || req.query?.password;

  if (!admin || !password) {
    return res.status(401).json({
      error: "Authentication required. Provide 'admin' and 'password' in request body or headers.",
    });
  }

  if (admin !== expectedAdmin || password !== expectedPassword) {
    return res.status(403).json({ error: "Access denied: Invalid admin username or password." });
  }

  next();
});

// Background Job & DLQ Routes
app.get("/api/jobs/dlq", getDlqJobsHandler);
app.delete("/api/jobs/dlq", clearDlqHandler);
app.get("/api/jobs/dlq/:jobId", getDlqJobDetailsHandler);
app.post("/api/jobs/dlq/:jobId/retry", retryDlqJobHandler);
app.delete("/api/jobs/dlq/:jobId", removeDlqJobHandler);
app.get("/api/jobs/:jobId", getJobStatusHandler);

// 404 & Error Handlers
app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` }));
app.use((err, req, res, next) => {
  console.error("API Error:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

export default app;
