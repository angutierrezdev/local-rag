# Local RAG: Pizza Restaurant Review Assistant

A Retrieval-Augmented Generation (RAG) application that answers questions about pizza restaurants using locally-hosted AI models. This project uses Ollama for running LLMs and embeddings locally, Chroma for vector storage, and LangChain for orchestration.

## What is RAG?

Retrieval-Augmented Generation (RAG) is an AI technique that combines:
- **Retrieval**: Searching a database for relevant documents/information
- **Augmented**: Using those retrieved documents as context
- **Generation**: Passing the context to a language model to generate answers

This approach allows AI models to answer questions based on specific data (your restaurant reviews) rather than just general knowledge.

## Features

- 🚀 **Fully Local**: Runs completely offline using Ollama
- 📊 **Vector Search**: Uses Chroma vector database for semantic similarity search
- 🤖 **LLM Powered**: Leverages LLama 3.2 model for intelligent answers
- 🧠 **Smart Embeddings**: Uses mxbai-embed-large for document embeddings
- 💬 **Interactive Q&A**: Command-line interface for asking questions about restaurants
- 📄 **Multi-Format Support**: Load documents from CSV, PDF, and DOCX files
- 🔄 **Auto-Detection**: Automatically detects file format by extension

## Prerequisites

- **Ollama**: Download and install from [ollama.ai](https://ollama.ai)
- **ChromaDB Server**: Required for the application
- **Node.js 18+**: For running the TypeScript version
- **Required Models in Ollama**:
  - `llama3.2` (for the language model)
  - `mxbai-embed-large` (for embeddings)

## Installation

### Setup Ollama Models

1. **Install Ollama models** (if not already installed):
   ```bash
   ollama pull llama3.2
   ollama pull mxbai-embed-large
   ```

2. **Start Ollama** (keep running in background):
   ```bash
   ollama serve
   ```

### TypeScript/Node.js Version

1. **Navigate to the project directory**:
   ```bash
   cd Local-RAG
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Start ChromaDB server** (in a separate terminal):
   Using Docker Compose (recommended):
   ```bash
   docker compose up
   ```
   
   Or using plain Docker:
   ```bash
   docker run -p 8000:8000 chromadb/chroma:0.5.4
   ```
   
   Or install ChromaDB locally:
   ```bash
   pip install chromadb
   chroma run --path ./chroma_langchain_db
   ```

4. **Setup vector database**:
   ```bash
   npm run setup-vector
   ```

5. **Run the application**:
   ```bash
   npm start
   ```
   
   Or run directly with ts-node:
   ```bash
   npm run dev
   ```

## Project Structure

```
Local-RAG/
├── src/
│   ├── main.ts                      # Interactive Q&A application
│   ├── vector.ts                    # Vector database setup
│   ├── loaders/
│   │   └── documentLoader.ts        # Multi-format document loader (CSV, PDF, DOCX)
│   ├── config.ts                    # Configuration service
│   ├── validation.ts                # Input validation and security
│   ├── types.ts                     # TypeScript type definitions
│   └── utils/
│       ├── esm.ts                   # ES module utilities
│       └── paths.ts                 # Path resolution utilities
├── data/
│   ├── realistic_restaurant_reviews.csv # Restaurant review dataset
│   └── (add your PDF/DOCX files here)   # Support for PDF and DOCX documents
├── prompts/
│   └── default.json                 # Prompt templates configuration
├── docs/
│   └── adding-pdf-docx-support.md   # Implementation guide
├── package.json                     # Node.js dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── docker-compose.yml               # ChromaDB Docker setup
├── .env.example                     # Environment variables template
└── README.md                        # This file

Note: When using docker-compose (recommended), vector database data is stored in a Docker volume (chroma-data).
The chroma_langchain_db/ directory is only created if you run Chroma locally with --path instead of Docker.

## Supported File Formats

The application automatically detects and loads documents from:

| Format | Extension | Use Case | Notes |
|--------|-----------|----------|-------|
| **CSV** | `.csv` | Structured tabular data | Original format, works with any CSV schema |
| **PDF** | `.pdf` | Scanned documents, reports | Extracts all text from all pages into single document |
| **Word** | `.docx`, `.doc` | Microsoft Word documents | Extracts text content, preserves structure |

File type is automatically detected from the file extension - no manual specification needed!

### Data Isolation

Each document file creates its own ChromaDB collection to prevent mixing incompatible data:

```bash
# These commands create SEPARATE collections:
npm run setup-vector data/restaurant_reviews.csv     # Collection: csv_restaurant_reviews
npm run setup-vector data/research_paper.pdf         # Collection: pdf_research_paper  
npm run setup-vector data/meeting_notes.docx         # Collection: docx_meeting_notes
```

**Important:** When you run the RAG application with `npm start`, it will use the collection from the **default file** specified in your configuration (`CSV_FILE_PATH` environment variable). To query a different document collection, update the `CSV_FILE_PATH` to point to that document's file path.
```

## Usage

1. **Start Ollama** (if not already running):
   ```bash
   ollama serve
   ```
   In a new terminal window, verify models are available:
   ```bash
   ollama list
   ```

2. **Start ChromaDB server** (in a separate terminal):
   Using Docker Compose (recommended):
   ```bash
   docker compose up
   ```
   
   Or using plain Docker:
   ```bash
   docker run -p 8000:8000 chromadb/chroma:0.5.4
   ```

3. **Setup vector database** (first time only):
   ```bash
   # Load from default CSV file
   npm run setup-vector
   
   # Or load from a different file (auto-detects format from extension)
   npm run setup-vector path/to/documents.pdf
   npm run setup-vector path/to/report.docx
   npm run setup-vector path/to/data.csv
   ```

4. **Run the application**:
   ```bash
   npm start
   ```

5. **Ask questions** about your documents:
   ```
   Enter your question about pizza restaurants (q=quit, clear=reset history): What are the best pizza places for family dining?
   ```

6. **Quit** by typing `q` when prompted.

## How It Works

The application follows a RAG architecture in two steps:

### Step 1: Vector Database Setup (`src/vector.ts`)
- Loads documents from CSV, PDF, or DOCX files (auto-detected by extension)
- File type detection happens in `src/loaders/documentLoader.ts`
- Converts each document/review into a numerical embedding using `mxbai-embed-large`
- Stores embeddings in Chroma vector database with metadata
- Creates a retriever configured to return the 5 most relevant documents

### Step 2: Question Answering (`src/main.ts`)
- User enters a question about the loaded documents
- The retriever searches for the 5 most relevant documents using semantic similarity
- These documents are passed as context to the `llama3.2` model
- The model generates an answer based on the context and user's question
- Answer is displayed to the user

## Document Loading Architecture

The `src/loaders/documentLoader.ts` module handles all file format conversions:

```
File Input → detectFileType() → Format-Specific Loader → LangChain Documents
           ↓
      [CSV|PDF|DOCX]
           ↓
      loadCsv() / loadPdf() / loadDocx()
           ↓
      Document[] with consistent metadata
```

All formats are converted to LangChain `Document` objects with `pageContent` and `metadata` fields for consistent downstream processing.

## Dependencies

See [package.json](package.json) for full list:
- **@langchain/community**: Community integrations (Ollama, Chroma)
- **@langchain/core**: Core LangChain functionality
- **chromadb**: ChromaDB client for vector storage
- **csv-parse**: CSV data processing
- **pdf-parse**: PDF text extraction
- **mammoth**: DOCX/DOC text extraction
- **@types/pdf-parse**: TypeScript types for pdf-parse

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and customize as needed:

```bash
cp .env.example .env
```

Available configuration options:
- `OLLAMA_BASE_URL` - Ollama server URL (default: http://localhost:11434)
- `OLLAMA_MODEL` - LLM model name (default: llama3.2)
- `OLLAMA_EMBEDDING_MODEL` - Embedding model name (default: mxbai-embed-large)
- `CHROMA_URL` - ChromaDB server URL (default: http://localhost:8000)
- `CHROMA_COLLECTION_NAME` - Vector collection name (default: restaurant_reviews_ts)
- `CSV_FILE_PATH` - Path to default document file (supports CSV, PDF, DOCX)
- `PROMPTS_CONFIG_PATH` - Path to prompts config (default: prompts/default.json)
- `DEBUG_VECTOR_TEST` - Enable debug similarity search test (default: false)

### Prompt Templates

Customize prompts by editing `prompts/default.json`:
- `template` - The prompt template sent to the LLM
- `question` - The question prompt shown to users

### Code Configuration

You can also modify configuration directly in the code:

**In `src/vector.ts`**:
- Pass custom file path as command line argument (format auto-detected):
  - `npm run setup-vector path/to/file.csv` - Load CSV data
  - `npm run setup-vector path/to/file.pdf` - Load PDF document
  - `npm run setup-vector path/to/file.docx` - Load Word document
- `k: 5` - Change the number of documents retrieved per query

**In `src/main.ts`**:
- All major settings now use environment variables (see above)

## Managing Collections

### Viewing Collections

List all collections in ChromaDB:

```bash
curl -s http://localhost:8000/api/v1/collections | jq -r '.[].name'
```

Get details about a specific collection:

```bash
curl -s http://localhost:8000/api/v1/collections/csv_realistic_restaurant_reviews | jq '.'
```

### Switching Between Documents

To query different documents, update the `CSV_FILE_PATH` environment variable:

```bash
# In your .env file
CSV_FILE_PATH=data/research_paper.pdf

# Or set it when running
CSV_FILE_PATH=data/meeting_notes.docx npm start
```

### Cleaning Up Collections

Remove all collections and start fresh:

```bash
# Using Docker Compose (recommended)
docker-compose down -v && docker-compose up -d

# This removes the Docker volume containing all collection data
```

Remove a specific collection using ChromaDB API:

```bash
curl -X DELETE http://localhost:8000/api/v1/collections/csv_old_data
```

## Troubleshooting

**Models not found error:**
- Ensure Ollama is running and models are installed: `ollama list`
- Pull missing models: `ollama pull llama3.2` or `ollama pull mxbai-embed-large`

**Connection refused error:**
- Make sure Ollama is running: `ollama serve` in another terminal

**ChromaDB connection error:**
- Ensure ChromaDB server is running on port 8000
- Docker: `docker run -p 8000:8000 chromadb/chroma`
- Local: `chroma run --path ./chroma_langchain_db`

**Module resolution errors:**
- Ensure you're using Node.js 18 or higher: `node --version`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

**Slow first run:**
- On first run, the vector database is created and all documents are embedded (this takes time)
- Subsequent runs will use the cached database

**PDF/DOCX loading issues:**
- Ensure pdf-parse and mammoth packages are installed: `npm install`
- For PDFs: Check the file is not password-protected or corrupted
- For DOCX: Ensure it's a valid Microsoft Word format file
- For large PDFs: The entire document is loaded into memory, so very large PDFs may be slow

## Performance Notes

- **First Run**: ~2-5 minutes (depending on dataset size and hardware) - embeddings are created and stored
- **Subsequent Runs**: ~2-5 seconds per query - using cached embeddings
- **Model Size**: LLama 3.2 requires ~2GB RAM minimum

## Future Improvements

- Add support for different restaurant types (not just pizza)
- Batch processing: Load multiple files at once
- Directory watching: Automatically ingest new files in a directory
- PDF page splitting: Create one document per page for better granularity
- Additional formats: Plain text, JSON, HTML, Markdown, Excel
- Chunking strategy: Split large documents into smaller chunks
- Implement caching for frequently asked questions
- Add web interface using Gradio or Streamlit
- Support for multiple vector database backends
- Fine-tune embeddings for better semantic search

See [docs/adding-pdf-docx-support.md](docs/adding-pdf-docx-support.md) for detailed implementation notes and enhancement ideas.

## License

MIT
