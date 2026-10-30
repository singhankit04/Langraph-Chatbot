import { TavilySearch } from "@langchain/tavily";
import { tool } from "@langchain/core/tools";
import { getQdrantVectorStore } from "../config/connections.js";
import "dotenv/config";

// 1. Document Search (RAG) Tool
export const documentSearchTool = tool(
  async ({ query }, config) => {
    const threadId = config?.configurable?.thread_id;
    if (!threadId) return ["No conversation thread identified.", []];

    try {
      const vectorStore = await getQdrantVectorStore("rag_documents");
      const docs = await vectorStore.similaritySearch(query, 4, {
        should: [
          { key: "metadata.conversationId", match: { value: threadId } },
          { key: "metadata.chatId", match: { value: threadId } },
        ],
      });

      if (!docs || docs.length === 0) {
        return [`No relevant content found in uploaded documents for: "${query}".`, []];
      }

      const formatted = docs
        .map((doc, idx) => `--- Excerpt ${idx + 1} (${doc.metadata?.source || "Doc"}, Page ${doc.metadata?.page || "N/A"}) ---\n${doc.pageContent}`)
        .join("\n\n");

      const sources = docs.map((d) => ({
        source: d.metadata?.source || "Uploaded Document",
        page: d.metadata?.page || null,
      }));

      return [formatted, sources];
    } catch (err) {
      console.warn(`[Document Search Tool Warning] ${err.message}`);
      return [`Retrieval error: ${err.message}`, []];
    }
  },
  {
    name: "search_uploaded_documents",
    description: "Search and retrieve relevant excerpts from documents uploaded by the user in this conversation.",
    schema: {
      type: "object",
      properties: { query: { type: "string", description: "Search terms or question" } },
      required: ["query"],
    },
    responseFormat: "content_and_artifact",
  }
);

// 2. Tavily Web Search Tool
export const searchTool = process.env.TAVILY_API_KEY?.trim()
  ? new TavilySearch({
      searchDepth: "advanced",
      topic: "general",
      maxResults: 3,
      timeRange: "day",
      includeRawContent: false,
      includeImages: false,
      apiKey: process.env.TAVILY_API_KEY.trim(),
    })
  : tool(
      async ({ query }) => `[Notice: TAVILY_API_KEY missing. Query: "${query}"]`,
      {
        name: "tavily_search",
        description: "Search the web for current information or news.",
        schema: {
          type: "object",
          properties: { query: { type: "string", description: "Search query" } },
          required: ["query"],
        },
      }
    );

export const tools = [documentSearchTool, searchTool];
export default tools;
