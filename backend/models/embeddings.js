import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

/**
 * Google Generative AI Embeddings
 * Uses gemini-embedding-2 with 1536-dimensional vectors for Qdrant storage.
 */
export const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey,
  model: "gemini-embedding-2",
  config: { outputDimensionality: 1536 },
});

export function createEmbeddings(customOptions = {}) {
  return new GoogleGenerativeAIEmbeddings({
    apiKey,
    model: "gemini-embedding-2",
    config: { outputDimensionality: 1536 },
    ...customOptions,
  });
}

export default embeddings;
