import { randomUUID } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantVectorStore } from "@langchain/qdrant";
import { HumanMessage } from "@langchain/core/messages";
import { embeddings } from "../models/embeddings.js";
import { chatbotApp, checkpointer } from "../chatbot/graph.js";
import { getQdrantVectorStore, DEFAULT_COLLECTION_NAME } from "../config/connections.js";

// ============================================================================
// Helper: Resolve Conversation ID / Thread ID from Client Request
// ============================================================================

/**
 * Extracts conversationId / threadId from URL params, body, query, or headers.
 * If not supplied by frontend, generates a random UUID.
 *
 * @param {import("express").Request} req
 * @returns {string} Valid conversationId (thread_id for MemorySaver)
 */
export function extractConversationId(req) {
  const candidate =
    req.params?.conversationId ||
    req.params?.chatId ||
    req.body?.conversationId ||
    req.body?.conversation_id ||
    req.body?.threadId ||
    req.body?.thread_id ||
    req.body?.chatId ||
    req.headers?.["x-conversation-id"] ||
    req.headers?.["x-chat-id"] ||
    req.query?.conversationId ||
    req.query?.chatId;

  return candidate && String(candidate).trim()
    ? String(candidate).trim()
    : randomUUID();
}

// ============================================================================
// Unified Chat Controller (Session-Isolated by conversationId / threadId)
// ============================================================================

/**
 * Upload & Index PDF for a specific chat conversation (POST /api/chat/:conversationId/upload)
 * Chunks the PDF and tags every chunk with metadata: { conversationId, chatId, source, page }
 */
export async function uploadPdfHandler(req, res) {
  try {
    const conversationId = extractConversationId(req);

    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded. Use the form-data key 'pdf'." });
    }

    // 1. Extract text from PDF buffer
    const parser = new PDFParse({ data: new Uint8Array(req.file.buffer) });
    const parsed = await parser.getText();
    await parser.destroy();

    const validPages = (parsed.pages || []).filter((p) => p.text?.trim());
    if (!validPages.length) {
      return res.status(400).json({
        error: `Failed to extract text or PDF is empty: "${req.file.originalname}"`,
      });
    }

    // 2. Split into overlapping chunks with conversationId & chatId metadata
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const docs = await splitter.createDocuments(
      validPages.map((p) => p.text),
      validPages.map((p) => ({
        source: req.file.originalname,
        page: p.num,
        conversationId,
        chatId: conversationId,
        threadId: conversationId,
      }))
    );

    // 3. Store into Qdrant vector database
    await QdrantVectorStore.fromDocuments(docs, embeddings, {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: DEFAULT_COLLECTION_NAME,
    });

    return res.json({
      message: `Successfully indexed "${req.file.originalname}" for conversation!`,
      conversationId,
      chatId: conversationId,
      threadId: conversationId,
      source: req.file.originalname,
      pagesCount: validPages.length,
      chunksCount: docs.length,
    });
  } catch (err) {
    console.error("Upload handler error:", err);
    return res.status(500).json({ error: err.message || "Failed to process PDF." });
  }
}

/**
 * Sanitizes model responses to eliminate raw markdown pipe tables and excessive asterisks,
 * transforming tables into clean, readable structured bullet points.
 *
 * @param {string} text
 * @returns {string}
 */
export function cleanStructuredOutput(text) {
  if (!text || typeof text !== "string") return text || "";

  const lines = text.split("\n");
  const cleaned = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Skip markdown table delimiter row, e.g. |---|---| or |:---|:---|
    if (/^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(trimmed)) {
      inTable = true;
      continue;
    }

    // 2. Clean heading lines that are entirely wrapped in ** (e.g. **Heading**)
    if (/^\*\*[^*]+\*\*$/.test(trimmed)) {
      cleaned.push(trimmed.slice(2, -2).trim());
      continue;
    }

    // 3. Transform pipe table rows into clean bullet points
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim().replace(/^\*\*|\*\*$/g, "").trim())
        .filter(Boolean);

      if (cells.length === 0) continue;

      // Skip header row if it contains generic table column titles
      const lowerFirst = cells[0].toLowerCase();
      if (!inTable && (lowerFirst === "section" || lowerFirst === "topic" || lowerFirst === "field" || lowerFirst === "category" || lowerFirst === "item")) {
        inTable = true;
        continue;
      }

      inTable = true;
      if (cells.length >= 2) {
        const title = cells[0];
        const description = cells.slice(1).join(" — ");
        cleaned.push(`• ${title}: ${description}`);
      } else {
        cleaned.push(`• ${cells[0]}`);
      }
      continue;
    } else {
      inTable = false;
    }

    // 3. Clean up lines with isolated pipes
    let line = rawLine;
    if (line.includes("|")) {
      line = line.replace(/\s*\|\s*/g, " — ");
    }

    // 4. Clean up redundant quadrupled asterisks ****
    line = line.replace(/\*{3,}/g, "**");

    cleaned.push(line);
  }

  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Handle user messages for a specific conversation session (POST /api/chat/:conversationId or POST /api/chat)
 * Invokes the LangGraph Agentic RAG workflow with session MemorySaver (thread_id = conversationId).
 * The agent autonomously decides whether to answer directly (normal chat), search uploaded documents (PDF RAG),
 * or perform web search.
 */
export async function chatHandler(req, res) {
  try {
    const conversationId = extractConversationId(req);
    const rawQuestion =
      req.body?.message ||
      req.body?.question ||
      (Array.isArray(req.body?.messages)
        ? req.body.messages[req.body.messages.length - 1]?.content
        : undefined);

    if (!rawQuestion || !String(rawQuestion).trim()) {
      return res.status(400).json({ error: "A valid 'message' or 'question' field is required." });
    }

    const question = String(rawQuestion).trim();

    // 1. Invoke LangGraph agent with MemorySaver thread_id set to conversationId
    const response = await chatbotApp.invoke(
      { messages: [new HumanMessage(question)] },
      { configurable: { thread_id: conversationId } }
    );

    const messages = response.messages || [];
    const lastMessage = messages[messages.length - 1];
    const rawAnswer = lastMessage?.content || "No response generated.";
    const answer = cleanStructuredOutput(rawAnswer);

    // 2. Extract citations / sources ONLY from tool messages executed during THIS current turn
    const sources = [];
    const seen = new Set();

    // Identify the start of the current turn (the last HumanMessage submitted)
    let currentTurnStartIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const isHuman =
        m._getType?.() === "human" ||
        m.constructor?.name === "HumanMessage" ||
        m.role === "human" ||
        m.type === "human";
      if (isHuman) {
        currentTurnStartIndex = i;
        break;
      }
    }

    // Only inspect tool messages produced during this current turn
    const currentTurnMessages =
      currentTurnStartIndex !== -1
        ? messages.slice(currentTurnStartIndex + 1)
        : [lastMessage];

    for (const msg of currentTurnMessages) {
      if (msg.name === "search_uploaded_documents" && Array.isArray(msg.artifact)) {
        for (const item of msg.artifact) {
          const key = `${item.source}:${item.page}`;
          if (!seen.has(key)) {
            seen.add(key);
            sources.push(item);
          }
        }
      }
    }

    return res.json({
      answer,
      sources,
      conversationId,
      chatId: conversationId,
      threadId: conversationId,
    });
  } catch (err) {
    console.error("Chat handler error:", err);
    return res.status(500).json({ error: err.message || "Failed to process chat message." });
  }
}

/**
 * Retrieve saved conversation history from MemorySaver for a given conversationId
 * GET /api/chat/:conversationId/history or GET /api/chat/:conversationId
 */
export async function getConversationHistoryHandler(req, res) {
  try {
    const conversationId = extractConversationId(req);
    const state = await chatbotApp.getState({
      configurable: { thread_id: conversationId },
    });

    const rawMessages = state?.values?.messages || [];
    const messages = rawMessages.map((msg) => ({
      role: msg._getType?.() || (msg.constructor?.name === "HumanMessage" ? "human" : "ai"),
      content: msg.content,
      name: msg.name,
      id: msg.id,
    }));

    return res.json({
      conversationId,
      chatId: conversationId,
      threadId: conversationId,
      messages,
      total: messages.length,
    });
  } catch (err) {
    console.error("Get conversation history error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch conversation history." });
  }
}

/**
 * Clears MemorySaver state checkpoint for this conversationId / thread_id
 * DELETE /api/chat/:conversationId
 */
export async function clearConversationHandler(req, res) {
  try {
    const conversationId = extractConversationId(req);
    if (checkpointer && typeof checkpointer.deleteThread === "function") {
      await checkpointer.deleteThread(conversationId);
    }

    return res.json({
      message: `Memory checkpoint deleted for conversationId / thread_id "${conversationId}".`,
      conversationId,
      chatId: conversationId,
      threadId: conversationId,
    });
  } catch (err) {
    console.error("Clear conversation error:", err);
    return res.status(500).json({ error: err.message || "Failed to clear conversation memory." });
  }
}
