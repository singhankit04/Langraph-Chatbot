import { randomUUID } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantVectorStore } from "@langchain/qdrant";
import { HumanMessage } from "@langchain/core/messages";
import { embeddings } from "../models/embeddings.js";
import { chatbotApp } from "../chatbot/graph.js";
import { getQdrantVectorStore, DEFAULT_COLLECTION_NAME } from "../config/connections.js";

// ============================================================================
// Unified Chat Controller (Session-Isolated by chatId)
// ============================================================================

/**
 * Upload & Index PDF for a specific chat session (POST /api/chat/:chatId/upload)
 * Chunks the PDF and tags every chunk with metadata: { chatId, source, page }
 */
export async function uploadPdfHandler(req, res) {
  try {
    const chatId = req.params.chatId || randomUUID();

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

    // 2. Split into overlapping chunks with chatId metadata
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const docs = await splitter.createDocuments(
      validPages.map((p) => p.text),
      validPages.map((p) => ({
        source: req.file.originalname,
        page: p.num,
        chatId,
      }))
    );

    // 3. Store into Qdrant vector database
    await QdrantVectorStore.fromDocuments(docs, embeddings, {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: DEFAULT_COLLECTION_NAME,
    });

    return res.json({
      message: `Successfully indexed "${req.file.originalname}" for chat session!`,
      chatId,
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
 * Handle user messages for a specific chat session (POST /api/chat/:chatId)
 * Performs RAG filtered strictly by chatId, then invokes LangGraph agent with session memory.
 */
export async function chatHandler(req, res) {
  try {
    const chatId = req.params.chatId || randomUUID();
    const rawQuestion = req.body.message || req.body.question;

    if (!rawQuestion || !rawQuestion.trim()) {
      return res.status(400).json({ error: "A valid 'message' or 'question' field is required." });
    }

    const question = rawQuestion.trim();

    // 1. Search for relevant documents indexed under THIS chatId
    let relevantDocs = [];
    try {
      const vectorStore = await getQdrantVectorStore(DEFAULT_COLLECTION_NAME);
      relevantDocs = await vectorStore.similaritySearch(question, 4, {
        must: [
          {
            key: "metadata.chatId",
            match: { value: chatId },
          },
        ],
      });
    } catch (searchErr) {
      // Collection empty or not yet created
      console.warn(`[Qdrant Search Notice] ${searchErr.message}`);
      relevantDocs = [];
    }

    // 2. Prepare prompt with document context if available
    let prompt = question;
    if (relevantDocs.length > 0) {
      const context = relevantDocs
        .map(
          (doc, idx) =>
            `[Document Chunk ${idx + 1} - Page ${doc.metadata?.page || "N/A"} (${doc.metadata?.source || "Uploaded File"})]:\n${doc.pageContent}`
        )
        .join("\n\n---\n\n");

      prompt = `You are an expert AI assistant. Use the following document context from the user's uploaded file to answer their question accurately. If the document does not contain enough information to answer, you may use your search tool or general knowledge, but clearly state what came from the document and what did not.

Context:
${context}

User Question: ${question}`;
    }

    // 3. Invoke LangGraph agent with thread_id set to chatId (isolated memory per chat)
    const response = await chatbotApp.invoke(
      { messages: [new HumanMessage(prompt)] },
      { configurable: { thread_id: chatId } }
    );

    const messages = response.messages || [];
    const lastMessage = messages[messages.length - 1];
    const answer = lastMessage?.content || "No response generated.";

    return res.json({
      answer,
      sources: relevantDocs.map((s) => ({
        source: s.metadata?.source,
        page: s.metadata?.page,
      })),
      chatId,
    });
  } catch (err) {
    console.error("Chat handler error:", err);
    return res.status(500).json({ error: err.message || "Failed to process chat message." });
  }
}
