# Import necessary libraries for vector embeddings and document storage
from langchain_ollama import OllamaEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
import os
import pandas as pd

# Load the restaurant reviews dataset from CSV file
df = pd.read_csv("realistic_restaurant_reviews.csv")

# Initialize the embedding model (converts text to numerical vectors)
# mxbai-embed-large is a local model that runs through Ollama
embeddings = OllamaEmbeddings(model="mxbai-embed-large")

# Set up the database location and check if we need to populate it
db_location = "./chroma_langchain_db"
# Only add documents if the database doesn't already exist
add_documents = not os.path.exists(db_location)

# If database doesn't exist, prepare documents for initial population
if add_documents:
    documents = []
    ids = []

    # Loop through each row in the dataframe and create Document objects
    for i, row in df.iterrows():
        # Create a Document with combined title and review as content
        document = Document(
            page_content=row["Title"] + " " + row["Review"],  # Main searchable text
            metadata={"rating": row["Rating"], "date": row["Date"]},  # Additional info
            id=str(i)  # Unique identifier for each document
        )
        ids.append(str(i))
        documents.append(document)

# Create or connect to the Chroma vector database
vector_store = Chroma(
    collection_name="restaurant_reviews",  # Name of the collection
    persist_directory=db_location,  # Where to store the database on disk
    embedding_function=embeddings  # Function to convert text to vectors
)

# Add all documents to the vector store (only on first run)
if add_documents:
    vector_store.add_documents(documents, ids=ids)

# Create a retriever that will find the most relevant documents
# k=5 means it will return the 5 most similar documents to a query
retriever = vector_store.as_retriever(
    search_kwargs={"k": 5}
)