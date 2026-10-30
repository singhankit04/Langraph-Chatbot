import { Queue, QueueEvents } from "bullmq";
import { redis } from "../config/connections.js";

// Primary queue for PDF ingestion and vectorization
export const pdfQueue = new Queue("pdf-processing-queue", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { age: 86400, count: 200 },
    removeOnFail: { age: 604800, count: 500 },
  },
});

// Dead letter queue for permanently failed jobs
export const pdfDlqQueue = new Queue("pdf-processing-dlq", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// QueueEvents listener for tracking job states and synchronous waiting
let queueEventsInstance = null;
export function getQueueEvents() {
  if (!queueEventsInstance) {
    queueEventsInstance = new QueueEvents("pdf-processing-queue", {
      connection: redis.duplicate(),
    });
  }
  return queueEventsInstance;
}






// Enqueue an uploaded PDF for background processing
export async function addPdfProcessingJob({ filePath, originalName, fileSize, conversationId, customMetadata = {} }, jobOptions = {}) {
  if (!filePath) throw new Error("Cannot enqueue PDF job without a valid filePath.");

  const job = await pdfQueue.add(
    "process-pdf",
    {
      filePath,
      originalName,
      fileSize,
      conversationId,
      chatId: conversationId,
      threadId: conversationId,
      enqueuedAt: new Date().toISOString(),
      customMetadata,
    },
    jobOptions
  );

  console.log(`[Queue] Enqueued job ${job.id} for "${originalName}" (${conversationId})`);
  return job;
}

// Retrieve status, progress, and result of a job
export async function getJobStatus(jobId) {
  const job = await pdfQueue.getJob(jobId);
  if (!job) return null;

  return {
    id: job.id,
    name: job.name,
    state: await job.getState(),
    progress: job.progress,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts || 3,
    data: {
      originalName: job.data.originalName,
      fileSize: job.data.fileSize,
      conversationId: job.data.conversationId,
      enqueuedAt: job.data.enqueuedAt,
    },
    failedReason: job.failedReason,
    returnvalue: job.returnvalue,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
}

export default {
  pdfQueue,
  pdfDlqQueue,
  addPdfProcessingJob,
  getJobStatus,
  getQueueEvents,
};
