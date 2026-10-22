import { TavilySearch } from "@langchain/tavily";
import { tool } from "@langchain/core/tools";
import "dotenv/config";

/**
 * 1. Tavily Web Search Tool
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

// Array of all available agent tools
export const tools = [searchTool];

export default tools;
