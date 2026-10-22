import { Worker } from "bullmq";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  redisConnection,
  saveDocumentsToQdrant,
  DEFAULT_COLLECTION_NAME,
} from "../config/connections.js";
import { PDF_QUEUE_NAME } from "./queue.js";
import {
  extractPagesFromBuffer,
  splitPagesIntoDocuments,
} from "../utils/ragWork.js";

/**
 * BullMQ Worker responsible for asynchronous PDF processing:
 * 1. Reads the uploaded PDF file from disk storage (backend/uploads/).
 * 2. Extracts pages and plain text.
 * 3. Splits text into overlapping semantic chunks with page metadata.
 * 4. Embeds chunks via Google Gemini (gemini-embedding-2, 1536-dim).
 * 5. Stores vectors into Qdrant vector database.
 * 6. Deletes the temporary file from disk upon successful indexing.
 */
export const pdfWorker = new Worker(
  PDF_QUEUE_NAME,
  async (job) => {
    const { filePath, originalFilename } = job.data;
    console.log(`\n[Worker] 🚀 Started Job #${job.id}: "${originalFilename}"`);

    // 1. Verify file exists in backend/uploads/
    if (!filePath || !existsSync(filePath)) {
      throw new Error(`Uploaded file not found on disk at: ${filePath}`);
    }

    await job.updateProgress(10); // 10%: file located

    // 2. Read the PDF buffer from disk
    console.log(
      `[Worker - Job #${job.id}] Reading file from disk: ${filePath}`,
    );
    const fileBuffer = await fs.readFile(filePath);

    await job.updateProgress(25); // 25%: file loaded into memory

    // 3. Extract text page by page
    console.log(`[Worker - Job #${job.id}] Extracting text from PDF...`);
    const pages = await extractPagesFromBuffer(fileBuffer);
    const validPages = pages.filter((p) => p.text && p.text.trim());

    if (!validPages.length) {
      // Clean up corrupt/empty PDF file
      await fs.unlink(filePath).catch(() => {});
      throw new Error(
        `Failed to extract readable text or PDF is empty: "${originalFilename}"`,
      );
    }

    await job.updateProgress(50); // 50%: text extracted

    // 4. Split text into chunks with page metadata
    console.log(
      `[Worker - Job #${job.id}] Splitting ${validPages.length} pages into overlapping chunks...`,
    );
    const docs = await splitPagesIntoDocuments(validPages, originalFilename, {
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    await job.updateProgress(70); // 70%: chunks generated

    // 5. Generate embeddings and store vectors into Qdrant
    console.log(
      `[Worker - Job #${job.id}] Embedding ${docs.length} chunks & indexing into Qdrant "${DEFAULT_COLLECTION_NAME}"...`,
    );
    await saveDocumentsToQdrant(docs, DEFAULT_COLLECTION_NAME);

    await job.updateProgress(90); // 90%: vectors written to Qdrant

    // 6. Delete temporary uploaded file from disk storage to free up space
    await fs.unlink(filePath).catch((err) => {
      console.warn(
        `[Worker - Job #${job.id}] Warning: Could not delete temp file ${filePath}: ${err.message}`,
      );
    });

    await job.updateProgress(100); // 100%: complete!
    console.log(
      `[Worker] ✅ Successfully indexed Job #${job.id}: "${originalFilename}" (${docs.length} chunks)\n`,
    );

    return {
      success: true,
      jobId: job.id,
      source: originalFilename,
      pagesCount: validPages.length,
      chunksCount: docs.length,
      collection: DEFAULT_COLLECTION_NAME,
      finishedAt: new Date().toISOString(),
    };
  },
  {
    connection: redisConnection,
    concurrency: 2, // Process max 2 PDFs in parallel to prevent API rate limits
  },
);

// Worker Lifecycle Events
pdfWorker.on("completed", (job) => {
  console.log(`[Worker Event] Job #${job.id} marked COMPLETED.`);
});

pdfWorker.on("failed", (job, err) => {
  console.error(`[Worker Event] ❌ Job #${job?.id} FAILED:`, err.message);
});

pdfWorker.on("error", (err) => {
  console.error(`[Worker Event] Worker internal error:`, err.message);
});

// Direct execution runner (node queue/worker.js)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`[Worker] Listening for jobs on queue "${PDF_QUEUE_NAME}"...`);
}

export default pdfWorker;
