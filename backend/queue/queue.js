import { Queue } from "bullmq";
import { redisConnection } from "../config/connections.js";

export const PDF_QUEUE_NAME = "pdf-processing";

/**
 * BullMQ Queue for PDF ingestion and vectorization tasks.
 */
export const pdfQueue = new Queue(PDF_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Auto-retry up to 3 times on transient network/API failures
    backoff: {
      type: "exponential",
      delay: 5000, // Wait 5s, 10s, 20s between retry attempts
    },
    removeOnComplete: { count: 200 }, // Keep last 200 completed jobs in Redis for history/status
    removeOnFail: { count: 500 },     // Keep last 500 failed jobs for debugging
  },
});

/**
 * Adds an uploaded PDF to the processing queue.
 *
 * @param {string} filePath - Path to the uploaded PDF stored in backend/uploads/
 * @param {string} originalFilename - Original filename of the uploaded file
 * @param {object} [metadata={}] - Optional metadata (e.g. userId, custom tags)
 * @returns {Promise<import("bullmq").Job>}
 */
export async function addPdfJob(filePath, originalFilename, metadata = {}) {
  return pdfQueue.add("process-pdf", {
    filePath,
    originalFilename,
    uploadedAt: new Date().toISOString(),
    ...metadata,
  });
}

export default pdfQueue;
