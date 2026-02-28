// Load environment variables from .env file
import "dotenv/config";
// Import necessary libraries for vector embeddings and document storage
import { OllamaEmbeddings } from "@langchain/ollama";
import { Chroma, type ChromaLibArgs } from "@langchain/community/vectorstores/chroma";
import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import path from "path";
// Import types and utilities
import { getDirname } from "./utils/esm.js";
import { ConfigService } from "./config.js";
// Import validation and document loading functions
import { validateFilePath } from "./validation.js";
import { loadDocuments, detectFileType } from "./loaders/documentLoader.js";

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

/**
 * Initialize the vector store and return a retriever
 * Supports CSV, PDF, and DOCX file formats
 * @param filePath - Optional path to document file (default from config)
 */
export async function getRetriever(filePath?: string) {
  // Get configuration service
  const configService = ConfigService.getInstance(import.meta.url);
  const config = configService.getConfig();
  
  // Get project root directory
  const projectRoot = getDirname(import.meta.url);
  const projectRootDir = path.dirname(projectRoot);

  // Use provided path or default from config
  const docPath = filePath
    ? filePath
    : path.join(projectRootDir, config.csv.filePath);

  // Validate file path to prevent directory traversal attacks
  const validatedPath = validateFilePath(docPath, projectRootDir);

  // Load documents from file (auto-detects type from extension)
  const documents = await loadDocuments(validatedPath);

  // Create unique collection name based on the source file
  // This prevents mixing data from different documents
  const fileType = detectFileType(validatedPath);
  const fileName = path.basename(validatedPath, path.extname(validatedPath));
  const collectionName = `${fileType}_${fileName}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .substring(0, 63); // ChromaDB collection name limit

  console.log(`Using collection: ${collectionName}`);
  console.log(`Source file: ${validatedPath}`);

  // Initialize the embedding model (converts text to numerical vectors)
  const embeddings = new OllamaEmbeddings(config.embeddings);

  let vectorStore: PatchedChroma;

  // Create ChromaDB config with the file-specific collection name
  const chromaConfig = {
    ...config.chroma,
    collectionName: collectionName,
  };

  // Prefer connecting to an existing collection, creating a new one if needed,
  // to avoid Python/JS compatibility issues. ChromaDB is running in Docker
  // on the configured URL (see docker-compose.yml).
  // The tenant and database specified in config.chroma will be auto-created if they don't exist.
  console.log("Creating/connecting to vector database...");
  console.log(`Config ChromaDB: ${JSON.stringify(chromaConfig)}`);

  // Documents have already been loaded and converted to LangChain Document objects

  try {
    // Try to connect to existing collection first
    vectorStore = await PatchedChroma.fromExistingCollection(
      embeddings,
      chromaConfig
    );
    console.log("Connected to existing collection");
    
    // Check if the collection has documents by getting the collection and checking count
    const collection = await vectorStore.ensureCollection();
    const count = await collection.count();
    console.log(`Collection has ${count} documents`);
    
    if (count === 0) {
      console.log("Collection is empty, adding documents...");
      await vectorStore.addDocuments(documents);
      console.log(`Added ${documents.length} documents to vector database`);
    }
  } catch (error) {
    // Collection doesn't exist or is incompatible, create a new one
    console.log("Creating new collection with documents...");

    vectorStore = await PatchedChroma.fromDocuments(
      documents,
      embeddings,
      chromaConfig
    );
    console.log(`Added ${documents.length} documents to vector database`);
  }

  // Create a retriever that will find the most relevant documents
  // k=5 means it will return the 5 most similar documents to a query
  console.log("Creating retriever with k=5");

  // Optionally test the vector store directly first.
  // Enable by setting DEBUG_VECTOR_TEST=true in the environment.
  if (config.debug.vectorTest) {
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
  // Check for command-line argument for file path
  const filePath = process.argv[2];
  if (filePath) {
    console.log(`Using custom file: ${filePath}`);
  }
  await getRetriever(filePath);
  console.log("Vector database setup complete!");
}
