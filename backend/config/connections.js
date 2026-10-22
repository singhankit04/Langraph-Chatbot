import { QdrantVectorStore } from "@langchain/qdrant";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { embeddings } from "../models/embeddings.js";
import "dotenv/config";

// ============================================================================
// 1. QDRANT VECTOR DATABASE CONNECTION
// ============================================================================
/**
 * Qdrant is used as the primary vector store for chunked document embeddings.
 * Vectors are generated using Google's gemini-embedding-2 (1536-dimensional).
 */
export const DEFAULT_COLLECTION_NAME = process.env.QDRANT_COLLECTION || "rag_documents";

/**
 * Connects to an existing Qdrant vector store collection for similarity search.
 *
 * @param {string} [collectionName=DEFAULT_COLLECTION_NAME] - Name of the collection
 * @returns {Promise<QdrantVectorStore>}
 */
export async function getQdrantVectorStore(collectionName = DEFAULT_COLLECTION_NAME) {
  return QdrantVectorStore.fromExistingCollection(embeddings, {
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    collectionName,
  });
}

/**
 * Creates/indexes documents in a Qdrant collection with vector embeddings.
 *
 * @param {Array<import("@langchain/core/documents").Document>} docs - Chunks to embed and store
 * @param {string} [collectionName=DEFAULT_COLLECTION_NAME] - Target collection
 * @returns {Promise<QdrantVectorStore>}
 */
export async function saveDocumentsToQdrant(docs, collectionName = DEFAULT_COLLECTION_NAME) {
  return QdrantVectorStore.fromDocuments(docs, embeddings, {
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    collectionName,
  });
}

// ============================================================================
// 2. REDIS CONNECTION (BullMQ Message Broker)
// ============================================================================
/**
 * BullMQ requires an active Redis instance to manage job queues, states, and retries.
 * maxRetriesPerRequest MUST be set to null as per BullMQ requirements.
 */
// export const redisConnection = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
//   maxRetriesPerRequest: null,
//   enableReadyCheck: false,
//   lazyConnect: true, // Connects when the queue or worker actively starts
// });

// redisConnection.on("error", (err) => {
//   // Gracefully log Redis connection errors without crashing the main Express thread
//   console.warn(`[Redis Connection Warning] ${err.message}`);
// });

// ============================================================================
// 3. BULLMQ QUEUE CONFIGURATION (Background PDF Ingestion)
// ============================================================================
/**
 * BullMQ Queue for offloading heavy PDF text extraction, chunking,
 * and Gemini vector embedding generation into background workers.
 */
// export const PDF_QUEUE_NAME = "pdf-processing";

// export const pdfQueue = new Queue(PDF_QUEUE_NAME, {
//   connection: redisConnection,
//   defaultJobOptions: {
//     attempts: 3, // Auto-retry up to 3 times on transient API / network failures
//     backoff: {
//       type: "exponential",
//       delay: 5000, // 5s, 10s, 20s exponential backoff
//     },
//     removeOnComplete: { count: 100 }, // Keep last 100 successful jobs in Redis
//     removeOnFail: { count: 500 },     // Keep last 500 failed jobs for debugging
//   },
// });

/**
 * Helper to push an uploaded PDF file into the BullMQ processing queue.
 *
 * @param {string} filePath - Absolute or relative path to the temporary PDF file on disk
 * @param {string} originalFilename - Original uploaded filename
 * @returns {Promise<string>} - Job ID
 */
export async function addPdfJob(filePath, originalFilename) {
  const job = await pdfQueue.add("process-pdf", {
    filePath,
    originalFilename,
    uploadedAt: new Date().toISOString(),
  });
  return job.id;
}
