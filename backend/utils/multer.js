import multer from "multer";
import path from "node:path";
import fs from "node:fs";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

function pdfFileFilter(req, file, cb) {
  if (
    file.mimetype === "application/pdf" ||
    file.originalname.toLowerCase().endsWith(".pdf")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed."));
  }
}

// 1. In-memory upload storage (for immediate buffer ingestion)
export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: pdfFileFilter,
});

// 2. Temporary disk storage (saves into backend/uploads/ for BullMQ worker)
const UPLOADS_DIR = path.resolve(import.meta.dirname, "../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const uploadDisk = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: pdfFileFilter,
});

// Default upload middleware
export const upload = uploadMemory;
export default upload;
