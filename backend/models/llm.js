import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenRouter } from "@langchain/openrouter";
import "dotenv/config";

// ============================================================================
// 1. CONVERSATIONAL CHAT MODELS (Normal Temperature: 0.7)
// Used for general chatbot conversation, multi-turn dialogue, and agent reasoning.
// ============================================================================
export const groqChat = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-120b",
  temperature: 0.7,
});

export const geminiChat = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
  model: "gemini-3.5-flash-lite",
  temperature: 0.7,
});

export const openrouterChat = new ChatOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  model: "nvidia/nemotron-3.5-lightning:free",
  temperature: 0.7,
});

// ============================================================================
// 2. EMBEDDING CHAT MODELS (Low Temperature: 0.0)
// Used strictly when querying facts from uploaded PDFs (RAG) to prevent hallucination.
// ============================================================================
export const groqRag = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-120b",
  temperature: 0.0,
});

export const geminiRag = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
  model: "gemini-3.5-flash-lite",
  temperature: 0.0,
});

export const openrouterRag = new ChatOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  model: "nvidia/nemotron-3.5-lightning:free",
  temperature: 0.0,
});

/**
 * Creates a conversational LLM runnable with normal temperature (0.7) and fallback chain.
 *
 * @param {Array} tools - Optional array of tools to bind across all fallback models
 * @returns {Runnable}
 */
export function getChatModelWithFallbacks(tools = []) {
  if (tools && tools.length > 0) {
    return groqChat.bindTools(tools).withFallbacks({
      fallbacks: [
        geminiChat.bindTools(tools),
        openrouterChat.bindTools(tools),
      ],
    });
  }

  return groqChat.withFallbacks({
    fallbacks: [geminiChat, openrouterChat],
  });
}

/**
 * Low-temperature model with automated fallbacks (Groq -> Gemini -> OpenRouter).
 * Used exclusively for answering questions from PDF context (RAG).
 */
export const embeddingChatModel = groqRag.withFallbacks({
  fallbacks: [geminiRag, openrouterRag],
});

/**
 * Standard conversational chat model with normal temperature (0.7) and fallbacks.
 */
export const chatModel = getChatModelWithFallbacks();

// Alias for backwards compatibility
export const defaultLLM = chatModel;

export default chatModel;
