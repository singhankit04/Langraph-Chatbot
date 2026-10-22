import { embeddingChatModel } from "../models/llm.js";
import { getQdrantVectorStore, DEFAULT_COLLECTION_NAME } from "../config/connections.js";

/**
 * Searches the vector store for relevant chunks and generates an answer using LLM.
 */
export async function queryRAG(question, vectorStore) {
  const store = vectorStore || (await getQdrantVectorStore(DEFAULT_COLLECTION_NAME));
  const relevantDocs = await store.similaritySearch(question, 4);

  if (!relevantDocs.length) {
    return {
      answer: "No relevant documents found in the database.",
      sources: [],
    };
  }

  const contextText = relevantDocs
    .map(
      (doc, idx) =>
        `[Source ${idx + 1} - Page ${doc.metadata?.page || "N/A"}]:\n${doc.pageContent}`
    )
    .join("\n\n---\n\n");

  const prompt = `You are an expert assistant answering questions based strictly on the provided context.
If the answer cannot be determined from the context, state that you do not know based on the document. Do not hallucinate.

Context:
${contextText}

Question: ${question}

Answer:`;

  const response = await embeddingChatModel.invoke(prompt);
  return {
    answer: response.content,
    sources: relevantDocs,
  };
}

/**
 * Handler for POST /api/chat
 */
export async function chatHandler(req, res) {
  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: "A valid 'question' field is required." });
    }

    const result = await queryRAG(question.trim());

    res.json({
      answer: result.answer,
      sources: result.sources.map((s) => ({
        source: s.metadata?.source,
        page: s.metadata?.page,
      })),
    });
  } catch (err) {
    console.error("Chat handler error:", err);
    res.status(500).json({ error: err.message });
  }
}
