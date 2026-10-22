import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import "dotenv/config";

import { upload } from "../utils/multer.js";
import { getQdrantVectorStore, DEFAULT_COLLECTION_NAME } from "../config/connections.js";
import {
  extractPagesFromBuffer,
  splitPagesIntoDocuments,
  ingestPdfBuffer,
  ingestPdf,
} from "../controllers/pdfController.js";
import { queryRAG } from "../controllers/chatController.js";

// Re-export functions for backwards compatibility
export {
  upload,
  extractPagesFromBuffer,
  splitPagesIntoDocuments,
  ingestPdfBuffer,
  ingestPdf,
  queryRAG,
};

// Interactive CLI Runner (node rag/index.js)
async function main() {
  const rl = readline.createInterface({ input, output });

  let vectorStore;
  try {
    console.log(`Connecting to Qdrant collection "${DEFAULT_COLLECTION_NAME}"...`);
    vectorStore = await getQdrantVectorStore(DEFAULT_COLLECTION_NAME);

    const checkDocs = await vectorStore.similaritySearch("test", 1);
    if (!checkDocs || checkDocs.length === 0) {
      console.log("Collection is empty. Please upload documents via the API.");
    }
  } catch {
    console.log("Collection does not exist yet. Please upload documents via the API.");
  }

  console.log("=== RAG Assistant Ready ===");
  console.log("Ask any question about your document. Type 'exit' to quit.\n");

  while (true) {
    const question = await rl.question("You: ");
    const trimmed = question.trim();

    if (!trimmed) continue;
    if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "/exit") {
      console.log("Exiting RAG assistant. Goodbye!");
      break;
    }

    try {
      process.stdout.write("\nSearching and generating answer...\r");

      const { answer, sources } = await queryRAG(trimmed, vectorStore);
      console.log(`\nAI: ${answer}\n`);
      if (sources.length) {
        console.log(`[Used ${sources.length} document chunk(s) from "${sources[0].metadata?.source || "corpus"}"]\n`);
      }
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
    }
  }

  rl.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
