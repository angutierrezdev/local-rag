# Adding PDF and DOCX Support to Local-RAG

## Overview

This document outlines the plan to extend the Local-RAG system to support PDF and Microsoft Word (DOCX) documents in addition to CSV files. The implementation will be **dynamic**, automatically detecting file types and loading them appropriately.

## Current State

The system currently:
- Loads restaurant reviews from CSV files
- Uses ChromaDB (running in Docker) for vector storage
- Uses Ollama embeddings for text vectorization
- Implements a patched Chroma class to fix compatibility issues

## Proposed Solution

### 1. Architecture Changes

```
Current:  File Path → CSV Parser → Documents → Vector Store
Proposed: File Path → Document Loader → Documents → Vector Store
                          ↓
                    [CSV|PDF|DOCX]
```

### 2. Required Dependencies

```bash
npm install pdf-parse mammoth @types/pdf-parse
```

**Packages:**
- `pdf-parse`: Parse PDF files and extract text
- `mammoth`: Extract text from DOCX files
- `@types/pdf-parse`: TypeScript types for pdf-parse

### 3. Implementation Steps

#### Step 1: Create Document Loader Module

**File:** `src/loaders/documentLoader.ts`

This module will:
- Detect file type by extension
- Load and parse different file formats
- Convert all formats to LangChain `Document` objects
- Maintain consistent metadata structure

**Supported formats:**
- `.csv` - Comma-separated values (existing functionality)
- `.pdf` - Portable Document Format
- `.docx` / `.doc` - Microsoft Word documents

#### Step 2: Refactor Vector Store

**File:** `src/vector.ts`

Changes needed:
- Replace direct CSV parsing with universal document loader
- Update function parameter naming (from `csvFilePath` to `filePath`)
- Maintain backward compatibility with existing CSV workflow
- Update validation to support multiple file types

#### Step 3: Update Validation

**File:** `src/validation.ts`

- Extend path validation to support PDF and DOCX extensions
- Maintain security measures (directory traversal prevention)

#### Step 4: Update Configuration

**File:** `src/config.ts`

- Update config to support multiple file types
- Add file type preferences/restrictions if needed

## Detailed Implementation

### Document Loader Module

```typescript
// src/loaders/documentLoader.ts
import { Document } from "@langchain/core/documents";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import path from "path";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import type { RestaurantReview } from "../types.js";

export type SupportedFileType = 'csv' | 'pdf' | 'docx';

/**
 * Detect file type from extension
 */
export function detectFileType(filePath: string): SupportedFileType {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.csv':
      return 'csv';
    case '.pdf':
      return 'pdf';
    case '.docx':
    case '.doc':
      return 'docx';
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

/**
 * Load PDF file and convert to documents
 */
async function loadPdf(filePath: string): Promise<Document[]> {
  const dataBuffer = readFileSync(filePath);
  const data = await pdf(dataBuffer);
  
  // Option 1: Single document with all pages
  return [
    new Document({
      pageContent: data.text,
      metadata: {
        source: filePath,
        pages: data.numpages,
        type: 'pdf',
      },
    }),
  ];
  
  // Option 2: Split by pages (future enhancement)
  // This would create one document per page for better granularity
}

/**
 * Load DOCX file and convert to documents
 */
async function loadDocx(filePath: string): Promise<Document[]> {
  const buffer = readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  
  return [
    new Document({
      pageContent: result.value,
      metadata: {
        source: filePath,
        type: 'docx',
      },
    }),
  ];
}

/**
 * Load CSV file (existing logic extracted)
 */
function loadCsv(filePath: string): Document[] {
  const csvContent = readFileSync(filePath, "utf-8");
  
  const records: RestaurantReview[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    cast: (value, context) => {
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
        type: 'csv',
      },
    });
  });
}

/**
 * Universal document loader - detects type and loads accordingly
 */
export async function loadDocuments(filePath: string): Promise<Document[]> {
  console.log(`Loading documents from: ${filePath}`);
  
  const fileType = detectFileType(filePath);
  console.log(`Detected file type: ${fileType}`);
  
  switch (fileType) {
    case 'csv':
      return loadCsv(filePath);
    case 'pdf':
      return await loadPdf(filePath);
    case 'docx':
      return await loadDocx(filePath);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
```

### Vector Store Integration

Key changes in `src/vector.ts`:

```typescript
import { loadDocuments } from "./loaders/documentLoader.js";

export async function getRetriever(filePath?: string) {
  // ...existing setup code...
  
  // Replace CSV-specific loading with universal loader
  const documents = await loadDocuments(validatedPath);

  // Initialize embeddings
  const embeddings = new OllamaEmbeddings(config.embeddings);

  // Rest of the vector store setup remains the same
  // ...
}
```

## Usage Examples

### Command Line

```bash
# CSV (existing functionality)
node dist/vector.js data/reviews.csv

# PDF document
node dist/vector.js data/research-paper.pdf

# DOCX document
node dist/vector.js data/report.docx
```

### Programmatic

```typescript
import { getRetriever } from './vector.js';

// Load from PDF
const pdfRetriever = await getRetriever('data/document.pdf');

// Load from DOCX
const docxRetriever = await getRetriever('data/report.docx');

// Load from CSV (existing)
const csvRetriever = await getRetriever('data/reviews.csv');
```

## Benefits

✅ **Dynamic Type Detection** - No need to specify file type manually  
✅ **Backward Compatible** - Existing CSV functionality unchanged  
✅ **Extensible** - Easy to add more formats (TXT, JSON, HTML, etc.)  
✅ **Same Infrastructure** - No changes to ChromaDB or Docker setup  
✅ **Type Safe** - Full TypeScript support  
✅ **Consistent API** - All file types use the same interface  

## Future Enhancements

### 1. Batch Processing
Load multiple files at once:

```typescript
export async function loadMultipleFiles(filePaths: string[]): Promise<Document[]> {
  const allDocuments: Document[] = [];
  for (const filePath of filePaths) {
    const docs = await loadDocuments(filePath);
    allDocuments.push(...docs);
  }
  return allDocuments;
}
```

### 2. Directory Watching
Automatically ingest new files:

```typescript
import { watch } from 'fs';

export function watchDirectory(dirPath: string, callback: (filePath: string) => void) {
  watch(dirPath, (eventType, filename) => {
    if (eventType === 'rename' && filename) {
      const fullPath = path.join(dirPath, filename);
      callback(fullPath);
    }
  });
}
```

### 3. Page Splitting for PDFs
Create one document per page for better granularity:

```typescript
async function loadPdfByPage(filePath: string): Promise<Document[]> {
  // Parse PDF
  const data = await pdf(dataBuffer);
  
  // Split into pages (requires additional parsing)
  return pages.map((page, index) => new Document({
    pageContent: page.text,
    metadata: {
      source: filePath,
      page: index + 1,
      type: 'pdf',
    },
  }));
}
```

### 4. Additional Format Support

Easy to add:
- **Plain Text** (`.txt`) - Direct file read
- **JSON** (`.json`) - Parse and extract fields
- **HTML** (`.html`) - Extract text content
- **Markdown** (`.md`) - Parse or use as-is
- **Excel** (`.xlsx`) - Similar to CSV parsing

### 5. Chunking Strategy

For large documents, implement text chunking:

```typescript
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

const chunks = await splitter.splitDocuments(documents);
```

## Security Considerations

- ✅ Maintain existing path validation
- ✅ Add file size limits for PDF/DOCX
- ✅ Sanitize metadata to prevent injection
- ✅ Validate file signatures (not just extensions)

## Testing Strategy

1. **Unit Tests** - Test each loader function independently
2. **Integration Tests** - Test end-to-end with ChromaDB
3. **Format Tests** - Test various PDF/DOCX structures
4. **Error Handling** - Test corrupted files, invalid formats

## Migration Path

1. Install dependencies
2. Create document loader module
3. Update vector.ts to use new loader
4. Update validation for new file types
5. Test with existing CSV files (should work unchanged)
6. Test with PDF files
7. Test with DOCX files
8. Update documentation and examples

## Rollback Plan

If issues arise:
- The changes are modular and isolated to the loader
- CSV functionality is extracted but unchanged
- Can easily revert to direct CSV parsing
- No changes to ChromaDB or embeddings

## Implementation Checklist

- [ ] Install npm packages (pdf-parse, mammoth)
- [ ] Create `src/loaders/` directory
- [ ] Implement `documentLoader.ts` with all loaders
- [ ] Update `src/vector.ts` to use universal loader
- [ ] Update `src/validation.ts` for new file types
- [ ] Update JSDoc comments and parameter names
- [ ] Test with CSV files (backward compatibility)
- [ ] Test with PDF files
- [ ] Test with DOCX files
- [ ] Update README.md with new capabilities
- [ ] Add example files for testing

## Questions & Decisions

- **Should we support .doc (old Word format)?** - Mammoth supports it
- **Page splitting for PDFs?** - Start with single document, add later
- **Character limits?** - May need chunking for very large files
- **Metadata preservation?** - Extract title, author from PDF metadata?

---

**Document Version:** 1.0  
**Last Updated:** February 13, 2026  
**Status:** Planning Phase
