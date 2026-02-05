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
- **Python 3.8+**: For running the Python application
- **Required Models in Ollama**:
  - `llama3.2` (for the language model)
  - `mxbai-embed-large` (for embeddings)

## Installation

1. **Install Ollama models** (if not already installed):
   ```bash
   ollama pull llama3.2
   ollama pull mxbai-embed-large
   ```

2. **Clone/navigate to the project directory**:
   ```bash
   cd Local-RAG
   ```

3. **Create a virtual environment** (recommended):
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

4. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## Project Structure

```
Local-RAG/
├── main.py                          # Interactive Q&A application
├── vector.py                        # Vector database setup and retriever
├── requirements.txt                 # Python dependencies
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

2. **Run the application**:
   ```bash
   python main.py
   ```

3. **Ask questions** about pizza restaurants:
   ```
   Enter your question about pizza restaurants (or q to quit): What are the best pizza places for family dining?
   ```

4. **Quit** by typing `q` when prompted.

## How It Works

### Step 1: Vector Database Setup (`vector.py`)
- Loads restaurant reviews from `realistic_restaurant_reviews.csv`
- Converts each review into a numerical embedding using `mxbai-embed-large`
- Stores embeddings in Chroma vector database with metadata (rating, date)
- Creates a retriever configured to return the 5 most relevant reviews

### Step 2: Question Answering (`main.py`)
- User enters a question about pizza restaurants
- The retriever searches for the 5 most relevant reviews using semantic similarity
- These reviews are passed as context to the `llama3.2` model
- The model generates an answer based on the context and user's question
- Answer is displayed to the user

## Requirements

See [requirements.txt](requirements.txt) for full list:
- **langchain**: LLM orchestration framework
- **langchain-ollama**: Ollama integration for LangChain
- **langchain-chroma**: Chroma vector database integration
- **pandas**: Data processing for CSV files

## Configuration

You can modify the following in the code:

**In `vector.py`**:
- `search_kwargs={"k": 5}` - Change the number of reviews retrieved per query

**In `main.py`**:
- `model="llama3.2"` - Switch to a different Ollama model
- `template` - Customize the prompt sent to the LLM

## Troubleshooting

**Models not found error:**
- Ensure Ollama is running and models are installed: `ollama list`
- Pull missing models: `ollama pull llama3.2` or `ollama pull mxbai-embed-large`

**Slow first run:**
- On first run, the vector database is created and all reviews are embedded (this takes time)
- Subsequent runs will use the cached database

**Connection refused error:**
- Make sure Ollama is running: `ollama serve` in another terminal

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

[Add your license here if applicable]

## Author

[Add your name/contact here if desired]
