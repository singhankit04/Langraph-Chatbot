
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import "dotenv/config";

import multer from "multer";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { ChatGroq } from "@langchain/groq";



const COLLECTION_NAME = "rag_documents";

// Multer middleware: store uploaded file in memory as a Buffer (max 25MB)
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed."));
    }
  },
});

// 1. Setup Embeddings & LLM
// model can generate a 3072, 768, or 1536-dimensional embedding
const embeddings = new GoogleGenerativeAIEmbeddings({     
  apiKey: process.env.GEMINI_API_KEY,
  model: "gemini-embedding-2",
  config: { outputDimensionality: 1536 },
});

const groq = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-120b",
  temperature: 0.1,
});

const llm = groq;

// 2. Ingestion Pipeline
export async function extractPagesFromBuffer(fileBuffer) {
  const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
  const result = await parser.getText();
  await parser.destroy();

  return result.pages.map((p) => ({
    pageNumber: p.num,
    text: p.text,
  }));
}

export async function ingestPdfBuffer(fileBuffer, originalFilename = "uploaded.pdf") {
  console.log(`\n--- Ingestion Pipeline ---`);
  console.log(`Processing: ${originalFilename}`);

  const pages = await extractPagesFromBuffer(fileBuffer);
  const validPages = pages.filter((p) => p.text && p.text.trim());

  if (!validPages.length) {
    throw new Error("Failed to extract pages or PDF is empty.");
  }

  console.log(`Extracted ${validPages.length} pages. Splitting into chunks...`);
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const texts = validPages.map((p) => p.text);
  const metadatas = validPages.map((p) => ({
    source: originalFilename,
    page: p.pageNumber,
  }));

  const docs = await splitter.createDocuments(texts, metadatas);

  console.log(`Generated ${docs.length} chunks with page numbers.`);
  console.log(`Uploading vectors to Qdrant collection: "${COLLECTION_NAME}"...`);

  const vectorStore = await QdrantVectorStore.fromDocuments(docs, embeddings, {
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: COLLECTION_NAME,
  });

  console.log("Ingestion completed successfully!\n");
  return {
    success: true,
    source: originalFilename,
    pagesCount: validPages.length,
    chunksCount: docs.length,
    vectorStore,
  };
}

export async function ingestPdf(filePath = DEFAULT_PDF_PATH) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found at: ${filePath}`);
  }
  const fileBuffer = fs.readFileSync(filePath);
  const result = await ingestPdfBuffer(fileBuffer, path.basename(filePath));
  return result.vectorStore;
}

// 3. Retrieval & Query Pipeline
export async function queryRAG(question, vectorStore) {
  const relevantDocs = await vectorStore.similaritySearch(question, 4);

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

  const response = await llm.invoke(prompt);
  return {
    answer: response.content,
    sources: relevantDocs,
  };
}

// 4. Interactive CLI Runner
async function main() {
  const rl = readline.createInterface({ input, output });
  const forceIngest = process.argv.includes("--ingest");

  let vectorStore;

  if (forceIngest) {
    vectorStore = await ingestPdf();
  } else {
    try {
      console.log(`Connecting to Qdrant collection "${COLLECTION_NAME}"...`);
      vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
        collectionName: COLLECTION_NAME,
      });

      // Quick check if collection actually has data
      const checkDocs = await vectorStore.similaritySearch("test", 1);
      if (!checkDocs || checkDocs.length === 0) {
        console.log("Collection is empty. Starting initial ingestion...");
        vectorStore = await ingestPdf();
      }
    } catch {
      console.log("Collection does not exist yet. Starting initial ingestion...");
      vectorStore = await ingestPdf();
    }
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
        console.log(`[Used ${sources.length} document chunk(s) from "${sources[0].metadata?.source || 'corpus'}"]\n`);
      }
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
    }
  }

  rl.close();
}

// Run only when directly executed (node rag/index.js)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
