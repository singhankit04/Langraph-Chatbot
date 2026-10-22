import { StateGraph, MessagesAnnotation, START, END, MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { getChatModelWithFallbacks } from "../models/llm.js";
import { tools } from "../utils/tools.js";
import "dotenv/config";

// Bind configured tools (e.g. Tavily search) to LLM with fallback chain (Groq -> Gemini -> OpenRouter)
const llm = getChatModelWithFallbacks(tools);

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

export default chatbotApp;
