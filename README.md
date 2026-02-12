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
   ```bash
   docker run -p 8000:8000 chromadb/chroma
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
│   └── vector.ts                    # Vector database setup
├── package.json                     # Node.js dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── realistic_restaurant_reviews.csv # Restaurant review dataset
├── chroma_langchain_db/            # Vector database (auto-created)
└── README.md                        # This file
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
   ```bash
   docker run -p 8000:8000 chromadb/chroma
   ```

3. **Setup vector database** (first time only):
   ```bash
   npm run setup-vector
   ```

4. **Run the application**:
   ```bash
   npm start
   ```

5. **Ask questions** about pizza restaurants:
   ```
   Enter your question about pizza restaurants (or q to quit): What are the best pizza places for family dining?
   ```

6. **Quit** by typing `q` when prompted.

## How It Works

The application follows a RAG architecture in two steps:

### Step 1: Vector Database Setup (`src/vector.ts`)
- Loads restaurant reviews from `realistic_restaurant_reviews.csv`
- Converts each review into a numerical embedding using `mxbai-embed-large`
- Stores embeddings in Chroma vector database with metadata (rating, date)
- Creates a retriever configured to return the 5 most relevant reviews

### Step 2: Question Answering (`src/main.ts`)
- User enters a question about pizza restaurants
- The retriever searches for the 5 most relevant reviews using semantic similarity
- These reviews are passed as context to the `llama3.2` model
- The model generates an answer based on the context and user's question
- Answer is displayed to the user

## Dependencies

See [package.json](package.json) for full list:
- **langchain**: LLM orchestration framework
- **@langchain/community**: Community integrations (Ollama, Chroma)
- **@langchain/core**: Core LangChain functionality
- **chromadb**: ChromaDB client for vector storage
- **csv-parse**: CSV data processing

## Configuration

You can modify the following in the code:

**In `src/vector.ts`**:
- `k: 5` - Change the number of reviews retrieved per query
- `model: "mxbai-embed-large"` - Switch embedding models
- `baseUrl: "http://localhost:11434"` - Ollama server URL
- `url: "http://localhost:8000"` - ChromaDB server URL

**In `src/main.ts`**:
- `model: "llama3.2"` - Switch to a different Ollama model
- `template` - Customize the prompt sent to the LLM

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
- On first run, the vector database is created and all reviews are embedded (this takes time)
- Subsequent runs will use the cached database

## Performance Notes

- **First Run**: ~2-5 minutes (depending on dataset size and hardware) - embeddings are created and stored
- **Subsequent Runs**: ~2-5 seconds per query - using cached embeddings
- **Model Size**: LLama 3.2 requires ~2GB RAM minimum

## Future Improvements

- Add support for different restaurant types (not just pizza)
- Implement caching for frequently asked questions
- Add web interface using Gradio or Streamlit
- Support for multiple vector database backends
- Fine-tune embeddings for better semantic search

## License

MIT
