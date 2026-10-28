import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "@langchain/qdrant";
import Redis from "ioredis";
import { embeddings } from "../models/embeddings.js";
import "dotenv/config";

// ============================================================================
// 1. QDRANT VECTOR DATABASE CONNECTION
// ============================================================================
export const DEFAULT_COLLECTION_NAME = process.env.QDRANT_COLLECTION || "rag_documents";

export const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

export async function getQdrantVectorStore(collectionName = DEFAULT_COLLECTION_NAME) {
  return QdrantVectorStore.fromExistingCollection(embeddings, {
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    collectionName,
  });
}

// ============================================================================
// 2. REDIS CONNECTION (BullMQ Message Broker)
// ============================================================================
export const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on("error", (err) => {
  console.warn(`[Redis Connection Warning] ${err.message}`);
});

export const redisConnection = redis;

// ============================================================================
// 3. CONNECTION VERIFICATION
// ============================================================================
/**
 * Verifies active connections to Redis and Qdrant.
 */
export async function checkConnections() {
  console.log("🔍 Checking external service connections...");

  // 1. Check Redis
  try {
    if (redis.status === "wait") await redis.connect();
    const pong = await redis.ping();
    if (pong === "PONG") {
      console.log("  ✅ Redis: Connected successfully");
    }
  } catch (err) {
    console.error(`  ❌ Redis: Connection failed (${err.message})`);
  }

  // 2. Check Qdrant & ensure chatId payload index
  try {
    const response = await qdrantClient.getCollections();
    const names = (response.collections || []).map((c) => c.name);
    console.log(`  ✅ Qdrant: Connected successfully (collections: [${names.join(", ")}])`);

    // Ensure metadata.chatId and metadata.conversationId payload indices exist for session-isolated filtering
    if (names.includes(DEFAULT_COLLECTION_NAME)) {
      try {
        await qdrantClient.createPayloadIndex(DEFAULT_COLLECTION_NAME, {
          field_name: "metadata.chatId",
          field_schema: "keyword",
        });
        console.log(`  ✅ Qdrant: "metadata.chatId" keyword index verified`);
      } catch (idxErr) {
        // Ignore if index already exists
      }

      try {
        await qdrantClient.createPayloadIndex(DEFAULT_COLLECTION_NAME, {
          field_name: "metadata.conversationId",
          field_schema: "keyword",
        });
        console.log(`  ✅ Qdrant: "metadata.conversationId" keyword index verified`);
      } catch (idxErr) {
        // Ignore if index already exists
      }
    }
  } catch (err) {
    console.error(`  ❌ Qdrant: Connection failed (${err.message})`);
  }
}
