import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import "dotenv/config";

/**
 * Google Generative AI Embeddings (gemini-embedding-2, 1536 dimensions)
 */
export const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  model: "gemini-embedding-2",
  config: { outputDimensionality: 1536 },
});

export default embeddings;
