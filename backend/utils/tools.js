import { TavilySearch } from "@langchain/tavily";
import { tool } from "@langchain/core/tools";
import { getQdrantVectorStore, DEFAULT_COLLECTION_NAME } from "../config/connections.js";
import "dotenv/config";

/**
 * 1. Document Search (RAG) Tool
 * Searches vector embeddings in Qdrant for documents uploaded in the current conversation thread.
 * Receives the LangGraph RunnableConfig to extract configurable.thread_id.
 */
export const documentSearchTool = tool(
  async ({ query }, config) => {
    const threadId = config?.configurable?.thread_id;
    if (!threadId) {
      return [
        "No conversation thread identified. Unable to search uploaded documents.",
        [],
      ];
    }

    try {
      const vectorStore = await getQdrantVectorStore(DEFAULT_COLLECTION_NAME);
      const docs = await vectorStore.similaritySearch(query, 4, {
        should: [
          { key: "metadata.conversationId", match: { value: threadId } },
          { key: "metadata.chatId", match: { value: threadId } },
        ],
      });

      if (!docs || docs.length === 0) {
        return [
          `No relevant content found in the uploaded documents for query: "${query}". Either no documents have been uploaded for this conversation yet, or the information is not present in the files.`,
          [],
        ];
      }

      const formatted = docs
        .map(
          (doc, idx) =>
            `--- Document Excerpt ${idx + 1} (Source: ${doc.metadata?.source || "Uploaded Document"}, Page: ${doc.metadata?.page || "N/A"}) ---\n${doc.pageContent}`
        )
        .join("\n\n");

      const sources = docs.map((d) => ({
        source: d.metadata?.source || "Uploaded Document",
        page: d.metadata?.page || null,
      }));

      return [formatted, sources];
    } catch (err) {
      console.warn(`[Document Search Tool Warning] ${err.message}`);
      return [
        `Could not retrieve documents due to an error: ${err.message}`,
        [],
      ];
    }
  },
  {
    name: "search_uploaded_documents",
    description:
      "Search and retrieve relevant excerpts from documents (PDFs, reports, contracts, manuals) uploaded by the user in this conversation. Use this whenever the user asks questions about their files, documents, policies, or specific uploaded material.",
    schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Specific search terms or semantic question to look up in the uploaded documents.",
        },
      },
      required: ["query"],
    },
    responseFormat: "content_and_artifact",
  }
);

/**
 * 2. Tavily Web Search Tool
 * Automatically falls back to a graceful mock tool if TAVILY_API_KEY is not configured.
 */
export const searchTool = process.env.TAVILY_API_KEY?.trim()
  ? new TavilySearch({
      searchDepth: "advanced",
      topic: "general",
      maxResults: 3,
      timeRange: "day",
      includeRawContent: false,
      includeImages: false,
      includeImageDescriptions: false,
      apiKey: process.env.TAVILY_API_KEY.trim(),
    })
  : tool(
      async ({ query }) => {
        return `[Notice: TAVILY_API_KEY missing in .env. Query: "${query}"]`;
      },
      {
        name: "tavily_search",
        description: "Search the web for current information or recent news.",
        schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
          },
          required: ["query"],
        },
      }
    );

// Array of all available agent tools (RAG Document Search + Tavily Web Search)
export const tools = [documentSearchTool, searchTool];

export default tools;
