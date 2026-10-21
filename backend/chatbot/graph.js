import { StateGraph, MessagesAnnotation, START, END, MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenRouter } from "@langchain/openrouter";
import { TavilySearch } from "@langchain/tavily";
import { tool } from "@langchain/core/tools";
import "dotenv/config";


let searchTool;
if (process.env.TAVILY_API_KEY?.trim()) {
  searchTool = new TavilySearch({
    searchDepth: "advanced",
    topic: "general",
    maxResults: 3,
    timeRange: "day",
    includeRawContent: false,
  includeImages: false,
  includeImageDescriptions: false,
    apiKey: process.env.TAVILY_API_KEY.trim(),
  });
} else {
  // Mock fallback to allow offline testing when TAVILY_API_KEY is not configured
  searchTool = tool(
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
}

const tools = [searchTool];



const groq = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-120b",
});

const gemini = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-3.5-flash-lite",
});

const openrouter = new ChatOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  model: "nvidia/nemotron-3.5-lightning:free",
});


// const llm =gemini.bindTools(tools)

const llm = groq.bindTools(tools).withFallbacks({
  fallbacks: [
    gemini.bindTools(tools),
    openrouter.bindTools(tools),
  ],
});




async function chatbotAgentNode(state) {
  const response = await llm.invoke(state.messages);
  // MessagesAnnotation reducer automatically appends returned messages to state history
  return { messages: [response] };
}

const webSearchToolNode = new ToolNode(tools);

function routeAgentDecision(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  // Route to search tool if model generated tool calls, otherwise finish
  if (lastMessage?.tool_calls?.length > 0) {
    return "call_web_search";
  }
  return "finish_turn";
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("chatbot_agent", chatbotAgentNode)
  .addNode("web_search_tool", webSearchToolNode)
  .addEdge(START, "chatbot_agent")
  .addConditionalEdges(
    "chatbot_agent",
    routeAgentDecision,
    {
      call_web_search: "web_search_tool",
      finish_turn: END,
    }
  )
  .addEdge("web_search_tool", "chatbot_agent");

// In-memory checkpointer to persist conversation history across turns by thread_id
export const checkpointer = new MemorySaver();

export const chatbotApp = workflow.compile({
  checkpointer,
});
