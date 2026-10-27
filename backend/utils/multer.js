import multer from "multer";

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

// In-memory upload storage for immediate PDF ingestion
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: pdfFileFilter,
});

export default upload;
