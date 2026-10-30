import { StateGraph, MessagesAnnotation, START, END, MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "@langchain/core/messages";
import { getChatModelWithFallbacks } from "../models/llm.js";
import { tools } from "./tools.js";
import "dotenv/config";

const llm = getChatModelWithFallbacks(tools);

const defaultSystemMessage = new SystemMessage(
  "You are EideticAI, an advanced AI enterprise knowledge and research assistant powered by LangGraph.\n" +
  "You maintain conversation context across turns using session checkpoints.\n\n" +
  "CORE TOOL USAGE RULES:\n" +
  "1. Normal Chat & Logic: For greetings, chit-chat, conversational follow-ups, user preferences (e.g. 'call me Don'), general questions, math, programming, or everyday conversation, ALWAYS answer directly WITHOUT using any tools.\n" +
  "2. Document Retrieval (RAG): ONLY call 'search_uploaded_documents' when the user explicitly asks a question regarding their uploaded files, PDFs, reports, or policies. Do NOT call this tool for normal conversation or unrelated follow-ups.\n" +
  "3. Live Web Search: For real-time news, today's events, or web data, call 'tavily_search'.\n\n" +
  "STRICT OUTPUT STRUCTURE & FORMATTING RULES:\n" +
  "- NEVER output raw markdown tables with vertical pipe characters (do NOT output '| Section | Points |' or '|---|---|').\n" +
  "- Avoid excessive double asterisks (**) and avoid wrapping entire paragraphs or headers in asterisks.\n" +
  "- Structure document summaries and answers with clean, professional sections:\n" +
  "  • Executive Overview: A concise 1-2 sentence high-level summary.\n" +
  "  • Key Takeaways / Points: Clean bullet points (•) describing core points in clear natural language.\n" +
  "  • Citations: Include document and page references naturally at the end (e.g., '(Page 2)').\n" +
  "- Keep the layout clean, readable, well-spaced, and comfortable for human readers."
);

async function chatbotAgentNode(state) {
  const hasSystem = state.messages.length > 0 && state.messages[0]._getType?.() === "system";
  const messagesToSend = hasSystem ? state.messages : [defaultSystemMessage, ...state.messages];
  const response = await llm.invoke(messagesToSend);
  return { messages: [response] };
}

function routeAgentDecision(state) {
  const last = state.messages[state.messages.length - 1];
  return last?.tool_calls?.length > 0 ? "call_tools" : "finish_turn";
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("chatbot_agent", chatbotAgentNode)
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "chatbot_agent")
  .addConditionalEdges("chatbot_agent", routeAgentDecision, {
    call_tools: "tools",
    finish_turn: END,
  })
  .addEdge("tools", "chatbot_agent");

export const checkpointer = new MemorySaver();
export const chatbotApp = workflow.compile({ checkpointer });
export default chatbotApp;
