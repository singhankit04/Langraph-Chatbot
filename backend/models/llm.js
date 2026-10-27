import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenRouter } from "@langchain/openrouter";
import "dotenv/config";

/**
 * Creates an LLM instance with automated fallback providers (Groq -> Gemini -> OpenRouter).
 *
 * @param {object} [options={}]
 * @param {number} [options.temperature=0.7] - Model temperature (0.7 for chat, 0.0 for strict RAG)
 * @param {Array} [options.tools=[]] - Optional tools to bind to all models
 * @returns {Runnable}
 */
export function createLlm({ temperature = 0.7, tools = [] } = {}) {
  const primary = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "openai/gpt-oss-120b",
    temperature,
  });

  const fallbacks = [
    new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
      model: "gemini-2.5-flash",
      temperature,
    }),
    new ChatOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      model: "nvidia/nemotron-3.5-lightning:free",
      temperature,
    }),
  ];

  if (tools?.length > 0) {
    return primary.bindTools(tools).withFallbacks({
      fallbacks: fallbacks.map((m) => m.bindTools(tools)),
    });
  }

  return primary.withFallbacks({ fallbacks });
}

// 1. Conversational model (temperature 0.7) for agent & general chat
export const chatModel = createLlm({ temperature: 0.7 });

// 2. Strict model (temperature 0.0) for context-grounded RAG answers
export const embeddingChatModel = createLlm({ temperature: 0.0 });

// Helper / backwards-compatibility
export const getChatModelWithFallbacks = (tools = []) => createLlm({ temperature: 0.7, tools });

export default chatModel;
