import {
  extractPagesFromBuffer,
  splitPagesIntoDocuments,
  ingestPdfBuffer,
  ingestPdf,
} from "../utils/ragWork.js";

// Re-export functions for convenient access
export {
  extractPagesFromBuffer,
  splitPagesIntoDocuments,
  ingestPdfBuffer,
  ingestPdf,
};

// ============================================================================
// Express Route Controller Handlers
// ============================================================================

/**
 * Synchronous Upload Handler for POST /api/upload-pdf
 * Uses in-memory buffer (uploadMemory) and blocks until Qdrant ingestion completes.
 */
export async function uploadPdfHandler(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error:
          "No file uploaded. Please upload a PDF using the form-data key 'pdf'.",
      });
    }

    const result = await ingestPdfBuffer(
      req.file.buffer,
      req.file.originalname,
    );

    res.json({
      message: `Successfully ingested "${req.file.originalname}" into Qdrant!`,
      source: result.source,
      pages: result.pagesCount,
      chunks: result.chunksCount,
    });
  } catch (err) {
    console.error("Upload handler error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Asynchronous Queue Handler for POST /api/upload-pdf/queue
 * Uses disk storage (uploadDisk) and offloads processing to BullMQ background queue.
 */
export async function queuePdfHandler(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error:
          "No file uploaded. Please upload a PDF using the form-data key 'pdf'.",
      });
    }

    const { addPdfJob } = await import("../queue/queue.js");
    const job = await addPdfJob(req.file.path, req.file.originalname);

    res.status(202).json({
      message: `File "${req.file.originalname}" accepted and queued for processing.`,
      jobId: job.id,
      status: "queued",
    });
  } catch (err) {
    console.error("Queue upload error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Status Polling Handler for GET /api/upload-status/:jobId
 * Returns the current state ('waiting' | 'active' | 'completed' | 'failed') and progress (0-100%).
 */
export async function getPdfJobStatusHandler(req, res) {
  try {
    const { pdfQueue } = await import("../queue/queue.js");
    const job = await pdfQueue.getJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }

    const state = await job.getState();
    res.json({
      jobId: job.id,
      state,
      progress: job.progress,
      result: job.returnvalue || null,
      failedReason: job.failedReason || null,
    });
  } catch (err) {
    console.error("Job status error:", err);
    res.status(500).json({ error: err.message });
  }
}
