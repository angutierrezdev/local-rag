import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import path from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import type { RestaurantReview } from "../types.js";

// Point pdfjs at the exact worker bundled with the installed package version so
// the API and worker versions always match (mismatched versions crash OCR).
// pathToFileURL is required — Node.js needs a file:// URL, not a bare filesystem path.
const _require = createRequire(import.meta.url);
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  _require.resolve("pdfjs-dist/build/pdf.worker.min.mjs")
).href;

// Text splitter for handling large documents that exceed embedding context length.
// mxbai-embed-large has a 512-token context window (~2048 chars for English, but
// OCR / dense text can tokenize much more heavily). 500 chars ≈ 125 tokens gives a
// comfortable safety margin while still producing coherent chunks.
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,  // Characters per chunk
  chunkOverlap: 50, // Overlap between chunks for context continuity
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
 * Ordered list of known SupportedFileType values.
 * Used to parse the clientId prefix out of a ChromaDB collection name.
 */
export const KNOWN_FILE_TYPES: ReadonlyArray<SupportedFileType> = [
  "csv",
  "pdf",
  "docx",
  "txt",
];

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
 * Render each PDF page to a canvas and run Tesseract OCR on it.
 * Used when regular text extraction yields no meaningful content (image-based PDFs).
 * @param dataBuffer - Raw PDF file buffer
 * @returns Full OCR-extracted text from all pages
 */
async function extractTextViaOCR(dataBuffer: Buffer): Promise<string> {
  const pdfData = new Uint8Array(dataBuffer);
  const pdf = await pdfjsLib.getDocument({ data: pdfData, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;

  console.log(`[OCR] Starting OCR on ${pdf.numPages} pages...`);
  const worker = await createWorker("eng");
  let fullText = "";

  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = createCanvas(viewport.width, viewport.height);

        await page.render({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          canvas: canvas as any,
          viewport,
        }).promise;

        const imageBuffer = canvas.toBuffer("image/png");
        const result = await worker.recognize(imageBuffer);
        
        if (!result || !result.data || !result.data.text) {
          console.warn(`[OCR] Page ${pageNum}: No text recognized (empty result)`);
          continue;
        }
        
        const pageText = result.data.text;
        fullText += pageText + "\n";
        
        console.log(`[OCR] Page ${pageNum}/${pdf.numPages}: ${pageText.trim().length} characters extracted`);
      } catch (pageError) {
        console.error(`[OCR] Error processing page ${pageNum}:`, pageError instanceof Error ? pageError.message : pageError);
      }
    }
  } finally {
    await worker.terminate();
  }

  if (fullText.trim().length === 0) {
    console.warn("[OCR] Warning: OCR extracted no text from any page");
  } else {
    console.log(`[OCR] Successfully extracted ${fullText.trim().length} total characters from ${pdf.numPages} pages`);
  }

  return fullText;
}

/**
 * Detect if extracted text is mostly metadata (page numbers, headers, footers).
 * Returns true if the PDF likely contains images with only extracted metadata.
 */
function isProbablyImagePDF(text: string): boolean {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  // Pattern detection: "-- X of Y --" style page numbers
  const pageNumberPattern = /^--\s*\d+\s+of\s+\d+\s*--$/;
  const pageNumberMatches = lines.filter((l) => pageNumberPattern.test(l.trim())).length;

  if (pageNumberMatches > 0) {
    // If more than 50% of non-empty lines are page numbers, it's metadata-heavy
    const metadataRatio = pageNumberMatches / lines.length;
    console.log(`[PDF] Metadata detection: ${pageNumberMatches}/${lines.length} lines are page numbers (${(metadataRatio * 100).toFixed(1)}%)`);
    return metadataRatio > 0.5;
  }

  // If we have very few characters per line on average, likely scanned
  const avgCharsPerLine = text.length / Math.max(lines.length, 1);
  if (avgCharsPerLine < 20) {
    console.log(`[PDF] Low content density: ${avgCharsPerLine.toFixed(1)} chars/line average`);
    return true;
  }

  return false;
}

/**
 * Uses regular text extraction for text-based PDFs, or falls back to OCR
 * for image-based / scanned PDFs (when extracted text is below 100 characters).
 * @param filePath - Path to the PDF file
 * @returns Array of Document objects with page content and metadata
 */
async function loadPdf(filePath: string): Promise<Document[]> {
  const dataBuffer = readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });

  let pageContent: string;
  let extractionMethod: "text" | "ocr";

  try {
    const result = await parser.getText();
    const extractedText = result.text.trim();

    console.log(`[PDF] Initial text extraction length: ${extractedText.length} characters`);

    // Check if it's a real text PDF or just metadata from an image PDF
    if (extractedText.length >= 100 && !isProbablyImagePDF(extractedText)) {
      // Text-based PDF — use direct extraction
      pageContent = result.text;
      extractionMethod = "text";
      console.log("✓ PDF: using regular text extraction");
    } else {
      // Image-based / scanned PDF — use OCR
      console.log(`✗ PDF: detected as image-based PDF, switching to OCR...`);
      pageContent = await extractTextViaOCR(dataBuffer);
      extractionMethod = "ocr";
      console.log(`[PDF] OCR text extraction length: ${pageContent.trim().length} characters`);
    }
  } finally {
    await parser.destroy();
  }

  const doc = new Document({
    pageContent,
    metadata: {
      source: filePath,
      type: "pdf",
      extractionMethod,
    },
  });

  // Split large documents into chunks to fit embedding context window
  const chunks = await textSplitter.splitDocuments([doc]);
  console.log(`PDF split into ${chunks.length} chunks (method: ${extractionMethod}, total: ${pageContent.length} chars)`);

  return chunks;
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
