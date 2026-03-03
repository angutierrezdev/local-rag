import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import path from "path";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import type { RestaurantReview } from "../types.js";

// Text splitter for handling large documents that exceed embedding context length
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000, // Characters per chunk
  chunkOverlap: 200, // Overlap between chunks for context continuity
});

/**
 * Supported file types for document loading
 */
export type SupportedFileType = "csv" | "pdf" | "docx" | "txt";

/**
 * Canonical set of supported file extensions.
 * Import this wherever file-type validation is needed.
 */
export const SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set([
  ".csv",
  ".pdf",
  ".docx",
  ".doc",
  ".txt",
]);

/**
 * Detect file type from extension
 * @param filePath - Path to the file
 * @returns The detected file type
 * @throws Error if file type is not supported
 */
export function detectFileType(filePath: string): SupportedFileType {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".csv":
      return "csv";
    case ".pdf":
      return "pdf";
    case ".docx":
    case ".doc":
      return "docx";
    case ".txt":
      return "txt";
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

/**
 * Load PDF file and convert to LangChain documents
 * @param filePath - Path to the PDF file
 * @returns Array of Document objects with page content and metadata
 */
async function loadPdf(filePath: string): Promise<Document[]> {
  const dataBuffer = readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });

  try {
    const result = await parser.getText();

    const doc = new Document({
      pageContent: result.text,
      metadata: {
        source: filePath,
        type: "pdf",
      },
    });

    // Split large documents into chunks to fit embedding context window
    const chunks = await textSplitter.splitDocuments([doc]);
    console.log(`PDF split into ${chunks.length} chunks`);

    return chunks;
  } finally {
    await parser.destroy();
  }
}

/**
 * Load DOCX file and convert to LangChain documents
 * @param filePath - Path to the DOCX file
 * @returns Array of Document objects with content and metadata
 */
async function loadDocx(filePath: string): Promise<Document[]> {
  const buffer = readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });

  const doc = new Document({
    pageContent: result.value,
    metadata: {
      source: filePath,
      type: "docx",
    },
  });

  // Split large documents into chunks to fit embedding context window
  const chunks = await textSplitter.splitDocuments([doc]);
  console.log(`DOCX split into ${chunks.length} chunks`);
  
  return chunks;
}

/**
 * Load plain text file and convert to LangChain documents
 * @param filePath - Path to the .txt file
 * @returns Array of Document objects with content and metadata
 */
async function loadTxt(filePath: string): Promise<Document[]> {
  const content = readFileSync(filePath, "utf-8");

  const doc = new Document({
    pageContent: content,
    metadata: {
      source: filePath,
      type: "txt",
    },
  });

  // Split large documents into chunks to fit embedding context window
  const chunks = await textSplitter.splitDocuments([doc]);
  console.log(`TXT split into ${chunks.length} chunks`);

  return chunks;
}

/**
 * Load CSV file and convert to LangChain documents
 * Assumes CSV has columns: Title, Date, Rating, Review
 * @param filePath - Path to the CSV file
 * @returns Array of Document objects with restaurant review content and metadata
 */
function loadCsv(filePath: string): Document[] {
  const csvContent = readFileSync(filePath, "utf-8");

  const records: RestaurantReview[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    cast: (value, context) => {
      // Convert Rating column to number
      if (context.column === "Rating") {
        return parseInt(value, 10);
      }
      return value;
    },
  });

  return records.map((row) => {
    return new Document({
      pageContent: `${row.Title} ${row.Review}`,
      metadata: {
        rating: row.Rating,
        date: row.Date,
        type: "csv",
        source: filePath,
      },
    });
  });
}

/**
 * Universal document loader that detects file type and loads accordingly
 * Supports CSV, PDF, DOCX/DOC, and TXT formats
 * @param filePath - Path to the file to load
 * @returns Promise resolving to array of Document objects
 * @throws Error if file type is not supported
 *
 * @example
 * // Load CSV file
 * const docs = await loadDocuments('data/reviews.csv');
 *
 * @example
 * // Load PDF file
 * const docs = await loadDocuments('data/report.pdf');
 *
 * @example
 * // Load DOCX file
 * const docs = await loadDocuments('data/document.docx');
 *
 * @example
 * // Load plain text file
 * const docs = await loadDocuments('data/notes.txt');
 */
export async function loadDocuments(filePath: string): Promise<Document[]> {
  console.log(`Loading documents from: ${filePath}`);

  const fileType = detectFileType(filePath);
  console.log(`Detected file type: ${fileType}`);

  switch (fileType) {
    case "csv":
      return loadCsv(filePath);
    case "pdf":
      return await loadPdf(filePath);
    case "docx":
      return await loadDocx(filePath);
    case "txt":
      return await loadTxt(filePath);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
