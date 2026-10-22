import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import fs from "node:fs";
import path from "node:path";
import { saveDocumentsToQdrant, DEFAULT_COLLECTION_NAME } from "../config/connections.js";

/**
 * Extracts page numbers and raw text content from a PDF file buffer.
 *
 * @param {Buffer|Uint8Array} fileBuffer - The PDF binary buffer
 * @returns {Promise<Array<{ pageNumber: number, text: string }>>}
 */
export async function extractPagesFromBuffer(fileBuffer) {
  const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
  const result = await parser.getText();
  await parser.destroy();

  return result.pages.map((p) => ({
    pageNumber: p.num,
    text: p.text,
  }));
}

/**
 * Splits extracted pages into LangChain Documents with chunk overlap and page metadata.
 *
 * @param {Array<{ pageNumber: number, text: string }>} pages - Extracted pages
 * @param {string} [sourceName="document.pdf"] - Name of the source file
 * @returns {Promise<Array<import("@langchain/core/documents").Document>>}
 */
export async function splitPagesIntoDocuments(
  pages,
  sourceName = "document.pdf"
) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const texts = pages.map((p) => p.text);
  const metadatas = pages.map((p) => ({
    source: sourceName,
    page: p.pageNumber,
  }));

  return splitter.createDocuments(texts, metadatas);
}

/**
 * Ingests an in-memory PDF buffer directly into Qdrant.
 *
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} [originalFilename="uploaded.pdf"] - File name
 * @returns {Promise<object>}
 */
export async function ingestPdfBuffer(fileBuffer, originalFilename = "uploaded.pdf") {
  console.log(`\n--- Ingestion Pipeline ---`);
  console.log(`Processing: ${originalFilename}`);

  const pages = await extractPagesFromBuffer(fileBuffer);
  const validPages = pages.filter((p) => p.text && p.text.trim());

  if (!validPages.length) {
    throw new Error("Failed to extract pages or PDF is empty.");
  }

  console.log(`Extracted ${validPages.length} pages. Splitting into chunks...`);
  const docs = await splitPagesIntoDocuments(validPages, originalFilename);

  console.log(`Generated ${docs.length} chunks. Indexing into Qdrant "${DEFAULT_COLLECTION_NAME}"...`);
  const vectorStore = await saveDocumentsToQdrant(docs, DEFAULT_COLLECTION_NAME);

  console.log("Ingestion completed successfully!\n");
  return {
    success: true,
    source: originalFilename,
    pagesCount: validPages.length,
    chunksCount: docs.length,
    vectorStore,
  };
}

/**
 * Ingests a PDF file from a local disk path into Qdrant.
 *
 * @param {string} filePath - Local disk path to PDF
 * @returns {Promise<object>}
 */
export async function ingestPdf(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`PDF file not found at: ${filePath}`);
  }
  const fileBuffer = fs.readFileSync(filePath);
  const result = await ingestPdfBuffer(fileBuffer, path.basename(filePath));
  return result.vectorStore;
}
