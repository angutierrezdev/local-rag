# Local RAG: Document Q&A Assistant

A Retrieval-Augmented Generation (RAG) application that answers questions about any document using locally-hosted AI models. Load CSV datasets, PDFs (including scanned / image-based ones), Word documents, or plain text files and query them through a conversational CLI.

Built with Ollama for LLM and embeddings, ChromaDB for vector storage, and LangChain for orchestration. Everything runs fully offline.

## What is RAG?

Retrieval-Augmented Generation (RAG) combines:
- **Retrieval**: Searching a vector database for semantically relevant chunks
- **Augmented**: Using those chunks as context for the language model
- **Generation**: The LLM generates an answer grounded in the retrieved context

## Features

- 🚀 **Fully Local**: Runs completely offline using Ollama
- 📊 **Vector Search**: ChromaDB for semantic similarity search
- 🤖 **LLM Powered**: LLaMA 3.2 (or any Ollama model) for answers
- 🧠 **Smart Embeddings**: `mxbai-embed-large` for document embeddings
- 📄 **Multi-Format**: CSV, PDF (text + OCR), DOCX/DOC, TXT
- 🔍 **OCR Support**: Automatically falls back to Tesseract OCR for scanned / image-based PDFs
- 🗂️ **Multi-Tenant Collections**: Each `{clientId}/{file}` gets its own isolated ChromaDB collection
- 🔀 **Multi-Collection Queries**: Selecting a collection automatically queries all files belonging to the same client
- 🗃️ **Folder Watcher**: Monitors a directory for new files and auto-ingests them (Dockerised)
- 💬 **Chat History**: Conversational Q&A with in-session memory (`clear` to reset)
- 🔁 **Resilient Embedding**: Batched ingestion with exponential-backoff retry and concurrency control

## Prerequisites

- **Ollama** — [ollama.ai](https://ollama.ai)
- **Docker** — for ChromaDB and the watcher service
- **Node.js 18+**
- **Ollama models**:
  ```bash
  ollama pull llama3.2
  ollama pull mxbai-embed-large
  ```

## Quick Start

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Create `.env`** (copy from example and edit):
   ```bash
   cp .env.example .env
   ```

3. **Start ChromaDB**:
   ```bash
   docker compose up -d chroma
   ```

4. **Ingest a document**:
   ```bash
   npm run setup-vector                              # default CSV from config
   npm run setup-vector data/my_report.pdf          # PDF (text or scanned)
   npm run setup-vector data/notes.docx             # Word document
   npm run setup-vector data/notes.txt              # Plain text
   ```

5. **Start the assistant**:
   ```bash
   npm start
   ```
   Select a collection when prompted, then ask questions.

## Project Structure

```
local-rag/
├── src/
│   ├── main.ts                    # Interactive Q&A CLI
│   ├── vector.ts                  # Vector store management (ingest, retrieve, collections)
│   ├── watcher.ts                 # Folder watcher — auto-ingests new files
│   ├── config.ts                  # ConfigService singleton
│   ├── validation.ts              # Input validation and path security
│   ├── types.ts                   # TypeScript type definitions
│   ├── loaders/
│   │   └── documentLoader.ts      # Multi-format document loader (CSV/PDF/DOCX/TXT + OCR)
│   └── utils/
│       ├── esm.ts                 # ES module helpers
│       └── paths.ts               # Path resolution utilities
├── data/
│   ├── app_reviews.csv
│   └── realistic_restaurant_reviews.csv
├── prompts/
│   ├── default.json               # Default prompt template
│   ├── app.json                   # App-reviews prompt template
│   └── pizza.json                 # Pizza-restaurant prompt template
├── docs/                          # Architecture and implementation notes
├── docker-compose.yml             # ChromaDB + watcher services
├── Dockerfile.watcher             # Docker image for the watcher service
├── package.json
├── tsconfig.json
└── .env.example
```

## Supported File Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| **CSV** | `.csv` | Expects columns `Title`, `Review`, `Rating`, `Date` |
| **PDF** | `.pdf` | Text extraction first; falls back to Tesseract OCR for scanned pages |
| **Word** | `.docx`, `.doc` | Raw text via mammoth (formatting not preserved) |
| **Text** | `.txt` | UTF-8; split into 500-char chunks |

## Collection Naming & Multi-Tenant Isolation

Every ingested file is stored in its own ChromaDB collection. The collection name is derived automatically:

```
{clientId}_{fileType}_{fileName}   # with a clientId
{fileType}_{fileName}              # without a clientId (direct CLI use)
```

Examples:
```
csv_realistic_restaurant_reviews
pdf_q3_report
alice_pdf_invoice
alice_docx_contract
```

When you select a collection from the CLI and it has a `clientId` prefix, all collections belonging to that client are loaded simultaneously and their results merged — so one query searches across all of a client's documents.

## Folder Watcher (Docker)

The watcher service monitors a folder for new documents and ingests them automatically.

**Expected folder structure:**
```
{API_DRIVE_PATH}/
  {clientId}/
    document.pdf
    notes.docx
```

**Start watcher only:**
```bash
docker compose up -d watcher
```

**Or run locally:**
```bash
npm run watch
```

The watcher:
1. Picks up files present at startup and new files added at runtime
2. Extracts the `clientId` from the parent folder name
3. Queues them sequentially to prevent concurrent ChromaDB writes
4. Skips duplicate files already queued

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start the interactive Q&A CLI |
| `npm run dev` | Same as start (ts-node) |
| `npm run setup-vector [file]` | Ingest a file into ChromaDB |
| `npm run watch` | Start the folder watcher |
| `npm run build` | Compile TypeScript to `dist/` |

## Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2` | LLM model for answering |
| `OLLAMA_EMBEDDING_MODEL` | `mxbai-embed-large` | Embedding model |
| `CHROMA_URL` | `http://localhost:8000` | ChromaDB server URL |
| `CHROMA_TENANT` | `default_tenant` | ChromaDB tenant |
| `CHROMA_DATABASE` | `default_database` | ChromaDB database |
| `CSV_FILE_PATH` | `data/realistic_restaurant_reviews.csv` | Default document for `npm run setup-vector` |
| `PROMPTS_CONFIG_PATH` | `prompts/default.json` | Path to prompt template file |
| `API_DRIVE_PATH` | `/watched` | Folder the watcher monitors (Docker volume) |
| `WATCH_POLLING` | `true` | Use polling (required on macOS with Docker volumes) |
| `CHAT_WINDOW_SIZE` | `10` | Max messages kept in conversational history |
| `DEBUG_VECTOR_TEST` | `false` | Run a test similarity search on startup |

### Prompt Templates

Edit any file in `prompts/` or create a new one. Set `PROMPTS_CONFIG_PATH` to switch templates. Required fields:

```json
{
  "template": "System prompt with {reviews} placeholder...",
  "question": "Prompt shown to the user"
}
```

## How It Works

### Ingestion (`src/vector.ts`, `src/loaders/documentLoader.ts`)

```
File → detectFileType() → loadCsv() / loadPdf() / loadDocx() / loadTxt()
     → RecursiveCharacterTextSplitter (500 chars / 50 overlap)
     → addDocumentsInBatches() → OllamaEmbeddings → ChromaDB collection
```

- **PDF path**: tries `pdf-parse` text extraction first; if the result is sparse or metadata-only (`isProbablyImagePDF`), switches to `pdfjs-dist` + Tesseract OCR page by page.
- **Batching**: chunks are accumulated up to a character budget (`maxBudgetPerBatch`, default 8 000) then flushed. Failed flushes are retried up to 3 times with exponential backoff (500 ms → 4 s). Concurrency can be increased via the `maxConcurrency` parameter (default: 1 = sequential).

### Query (`src/main.ts`)

```
User question → sanitizeQuestion() → retriever(s).invoke()
             → top-5 chunks per collection → deduplicate → LLM chain
             → answer with chat history
```

## Managing Collections

**List all collections:**
```bash
curl -s http://localhost:8000/api/v1/collections | jq -r '.[].name'
```

**Delete a collection:**
```bash
curl -X DELETE http://localhost:8000/api/v1/collections/csv_old_data
```

**Reset everything (wipe all data):**
```bash
docker compose down -v && docker compose up -d chroma
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Missing required environment variable` | Copy `.env.example` → `.env` and fill in `OLLAMA_BASE_URL` and `OLLAMA_MODEL` |
| `ResponseError: input length exceeds context length` | Chunk size is already set to 500 chars; if still occurring lower `maxBudgetPerBatch` in `vector.ts` |
| ChromaDB connection refused | Run `docker compose up -d chroma` |
| Ollama connection refused | Run `ollama serve` |
| Models not found | `ollama pull llama3.2 && ollama pull mxbai-embed-large` |
| Slow first run | Normal — embeddings are computed and stored; subsequent runs use the cache |
| OCR produces garbled text | Increase render scale in `extractTextViaOCR` (`scale: 2.0` → `3.0`) |
| Module resolution errors | Node.js 18+ required: `node --version` |

## Dependencies

| Package | Purpose |
|---------|---------|
| `@langchain/ollama` | Ollama LLM + embeddings |
| `@langchain/community` | ChromaDB vector store integration |
| `@langchain/core` | Prompt templates, chains, message history |
| `@langchain/textsplitters` | `RecursiveCharacterTextSplitter` |
| `chromadb` | ChromaDB client |
| `pdf-parse` | PDF text extraction |
| `pdfjs-dist` | PDF rendering for OCR |
| `tesseract.js` | OCR engine |
| `@napi-rs/canvas` | Canvas rendering for OCR page rasterisation |
| `mammoth` | DOCX/DOC text extraction |
| `csv-parse` | CSV parsing |
| `chokidar` | File system watcher |
| `dotenv` | Environment variable loading |

## License

MIT
