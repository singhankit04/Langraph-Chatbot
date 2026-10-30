import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const uploadsDir = path.resolve(import.meta.dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function pdfFileFilter(req, file, cb) {
  if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed."));
  }
}

// Disk storage for background queue processing
export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
      cb(null, `${Date.now()}-${randomUUID()}-${safeName}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: pdfFileFilter,
});

export default upload;
