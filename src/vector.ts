// Import necessary libraries for vector embeddings and document storage
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { Chroma, type ChromaLibArgs } from "@langchain/community/vectorstores/chroma";
import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Patched Chroma class that fixes the "Invalid where clause" error.
 * The base class always sends `where: {}` even when no filter is provided,
 * which newer ChromaDB versions reject.
 */
class PatchedChroma extends Chroma {
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ) {
    if (filter && this.filter) {
      throw new Error("cannot provide both `filter` and `this.filter`");
    }
    const _filter = filter ?? this.filter;
    const collection = await this.ensureCollection();

    const queryOptions: Record<string, unknown> = {
      queryEmbeddings: query,
      nResults: k,
    };
    // Only include `where` if a filter is actually provided
    if (_filter && Object.keys(_filter).length > 0) {
      queryOptions.where = { ..._filter };
    }

    const result = await collection.query(queryOptions as any);
    const { ids, distances, documents, metadatas } = result;
    if (!ids || !distances || !documents || !metadatas) {
      return [];
    }
    const [firstIds] = ids;
    const [firstDistances] = distances;
    const [firstDocuments] = documents;
    const [firstMetadatas] = metadatas;

    const results: [Document, number][] = [];
    for (let i = 0; i < firstIds.length; i++) {
      results.push([
        new Document({
          pageContent: firstDocuments[i] ?? "",
          metadata: firstMetadatas[i] ?? {},
        }),
        firstDistances[i],
      ]);
    }
    return results;
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: ChromaLibArgs
  ): Promise<PatchedChroma> {
    const instance = new PatchedChroma(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }
}

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the structure of our CSV data
interface RestaurantReview {
  Title: string;
  Date: string;
  Rating: number;
  Review: string;
}

/**
 * Initialize the vector store and return a retriever
 * @param csvFilePath - Optional path to CSV file (default from env or hardcoded)
 */
export async function getRetriever(csvFilePath?: string) {
  // Load environment variables or use defaults
  const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large";
  const CHROMA_URL = process.env.CHROMA_URL || "http://localhost:8000";
  const CHROMA_COLLECTION_NAME = process.env.CHROMA_COLLECTION_NAME || "restaurant_reviews_ts";
  const DEFAULT_CSV_PATH = process.env.CSV_FILE_PATH || "realistic_restaurant_reviews.csv";
  const DEBUG_VECTOR_TEST = process.env.DEBUG_VECTOR_TEST === "true";

  // Use provided path or default
  const csvPath = csvFilePath 
    ? path.resolve(csvFilePath)
    : path.join(__dirname, "..", DEFAULT_CSV_PATH);
  
  console.log(`Loading reviews from: ${csvPath}`);
  const csvContent = readFileSync(csvPath, "utf-8");

  // Parse CSV data
  const records: RestaurantReview[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    cast: (value, context) => {
      // Convert Rating to number
      if (context.column === "Rating") {
        return parseInt(value, 10);
      }
      return value;
    },
  });

  // Initialize the embedding model (converts text to numerical vectors)
  const embeddings = new OllamaEmbeddings({
    model: OLLAMA_EMBEDDING_MODEL,
    baseUrl: OLLAMA_BASE_URL,
  });

  let vectorStore: PatchedChroma;

  // Prefer connecting to an existing collection, creating a new one if needed,
  // to avoid Python/JS compatibility issues. ChromaDB is running in Docker
  // on port 8000 (see docker-compose.yml).
  console.log("Creating/connecting to vector database...");

  try {
    // Try to connect to existing collection first
    vectorStore = await PatchedChroma.fromExistingCollection(
      embeddings,
      {
        collectionName: CHROMA_COLLECTION_NAME,
        url: CHROMA_URL,
      }
    );
    console.log("Connected to existing collection");
  } catch (error) {
    // Collection doesn't exist or is incompatible, create a new one
    console.log("Creating new collection with documents...");
    
    // Build documents only when we need to create a new collection
    const documents = records.map((row, index) => {
      return new Document({
        pageContent: `${row.Title} ${row.Review}`, // Main searchable text
        metadata: {
          rating: row.Rating,
          date: row.Date,
        }, // Additional info
      });
    });
    
    vectorStore = await PatchedChroma.fromDocuments(
      documents,
      embeddings,
      {
        collectionName: CHROMA_COLLECTION_NAME,
        url: CHROMA_URL,
      }
    );
    console.log(`Added ${documents.length} documents to vector database`);
  }

  // Create a retriever that will find the most relevant documents
  // k=5 means it will return the 5 most similar documents to a query
  console.log("Creating retriever with k=5");

  // Optionally test the vector store directly first.
  // Enable by setting DEBUG_VECTOR_TEST=true in the environment.
  if (DEBUG_VECTOR_TEST) {
    try {
      console.log("Testing vector store with a direct search...");
      const testResults = await vectorStore.similaritySearch("pizza", 2);
      console.log(
        `Direct search successful! Found ${testResults.length} documents`,
      );
      if (testResults.length > 0) {
        console.log(
          "Sample result:",
          testResults[0].pageContent.substring(0, 100) + "...",
        );
      }
    } catch (error) {
      console.error("Direct search failed:", error);
    }
  }

  const retriever = vectorStore.asRetriever({
    k: 5,
    searchType: "similarity",
  });

  console.log("Retriever created successfully");
  return retriever;
}

// Allow running this file directly to setup the vector database
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Setting up vector database...");
  // Check for command-line argument for CSV path
  const csvPath = process.argv[2];
  if (csvPath) {
    console.log(`Using custom CSV file: ${csvPath}`);
  }
  await getRetriever(csvPath);
  console.log("Vector database setup complete!");
}
