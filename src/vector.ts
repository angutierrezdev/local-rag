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
import { loadDocuments, detectFileType, KNOWN_FILE_TYPES } from './loaders/document-loader.js';

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
 * Retry an async operation with exponential backoff.
 * Suitable for transient network / embedding-service errors.
 *
 * @param fn          - Async factory that produces the operation to attempt
 * @param maxRetries  - Total extra attempts after the first failure (default: 3)
 * @param baseDelayMs - Initial delay in ms, doubled on every retry (default: 500)
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * 2 ** attempt;
        console.warn(
          `[embed] Batch failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay} ms…`,
          err
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Add documents to a vector store in dynamically-sized batches.
 * Chunks are accumulated until adding the next one would exceed the budget,
 * then the batch is flushed. This keeps each embedding request well within the
 * model's context window regardless of how large or small individual chunks are.
 *
 * @param maxBudgetPerBatch - Budget per request in the unit returned by `sizeOf`
 *   (default: 8000 chars — conservative for mxbai-embed-large's ~512-token window)
 * @param sizeOf            - Function that returns the "size" of a document for
 *   budget purposes. Defaults to character count. Swap in a real token-counter
 *   (e.g. via `tiktoken` or `@langchain/core`) for more precise control.
 * @param maxConcurrency    - Max simultaneous flush tasks (default: 1 = sequential).
 *   Increase only if the embedding service supports parallel requests.
 * @param maxRetries        - Retry attempts per batch on transient failures (default: 3).
 */
async function addDocumentsInBatches(
  store: PatchedChroma,
  documents: Document[],
  maxBudgetPerBatch = 8000,
  sizeOf: (doc: Document) => number = (doc) => doc.pageContent.length,
  maxConcurrency = 1,
  maxRetries = 3
): Promise<void> {
  let embedded = 0;

  // ----- Semaphore for concurrency control -----
  let active = 0;
  const waitQueue: Array<() => void> = [];

  const acquire = (): Promise<void> =>
    new Promise((resolve) => {
      if (active < maxConcurrency) {
        active++;
        resolve();
      } else {
        waitQueue.push(() => {
          active++;
          resolve();
        });
      }
    });

  const release = (): void => {
    active--;
    waitQueue.shift()?.();
  };

  // ----- Flush a captured snapshot -----
  const flushSnapshot = async (snapshot: Document[], snapshotBudget: number): Promise<void> => {
    if (snapshot.length === 0) return;
    await acquire();
    try {
      await retryWithBackoff(() => store.addDocuments(snapshot), maxRetries);
      embedded += snapshot.length;
      console.log(
        `[embed] Embedded ${embedded}/${documents.length} chunks` +
        ` (batch: ${snapshot.length} chunks, ${snapshotBudget} units)`
      );
    } finally {
      release();
    }
  };

  // ----- Accumulate and dispatch batches -----
  let batch: Document[] = [];
  let batchBudget = 0;
  const pending: Promise<void>[] = [];

  for (const doc of documents) {
    const docSize = sizeOf(doc);

    // Warn when a single document exceeds the budget — it will be flushed alone
    if (docSize > maxBudgetPerBatch) {
      console.warn(
        `[embed] Document chunk (${docSize} units) exceeds maxBudgetPerBatch ` +
        `(${maxBudgetPerBatch}). Flushing as a single-document batch.`
      );
    }

    // If adding this doc would exceed the budget, dispatch current batch first
    if (batchBudget + docSize > maxBudgetPerBatch && batch.length > 0) {
      pending.push(flushSnapshot(batch, batchBudget));
      batch = [];
      batchBudget = 0;
    }

    batch.push(doc);
    batchBudget += docSize;
  }

  // Flush any remaining documents
  pending.push(flushSnapshot(batch, batchBudget));

  await Promise.all(pending);
}

/**
 * Find an existing ChromaDB collection or create a new one populated with documents
 * loaded from `filePath`. Separating this responsibility from `getRetriever` keeps
 * each function focused on a single concern and avoids mutable intermediate state.
 *
 * @returns A fully-populated `PatchedChroma` instance — always defined, never null.
 */
async function resolveVectorStore(
  embeddings: OllamaEmbeddings,
  chromaConfig: ChromaLibArgs,
  filePath: string
): Promise<PatchedChroma> {
  // Step 1: Try to connect to an existing collection — isolated so that any
  // error thrown during document loading below is never swallowed here.
  try {
    const existing = await PatchedChroma.fromExistingCollection(embeddings, chromaConfig);
    console.log("Connected to existing collection");

    const collection = await existing.ensureCollection();
    const count = await collection.count();
    console.log(`Collection has ${count} documents`);

    if (count > 0) {
      console.log("Collection already populated — skipping ingestion");
      return existing;
    }

    // Collection exists but is empty: populate it now
    console.log("Collection is empty, loading and adding documents...");
    const documents = await loadDocuments(filePath);
    await addDocumentsInBatches(existing, documents);
    console.log(`Added ${documents.length} documents to vector database`);
    return existing;
  } catch (collectionError) {
    // Only treat this as "collection not found" — rethrow anything that looks
    // like a document-loading or embedding error so it surfaces properly.
    if (collectionError instanceof Error && collectionError.message.includes("does not exist")) {
      console.log("Collection not found — loading documents and creating collection...");
    } else {
      throw collectionError;
    }
  }

  // Step 2: Collection did not exist — create it from scratch
  const documents = await loadDocuments(filePath);
  const store = new PatchedChroma(embeddings, chromaConfig);
  await addDocumentsInBatches(store, documents);
  console.log(`Added ${documents.length} documents to vector database`);
  return store;
}

/**
 * Initialize the vector store and return a retriever
 * Supports CSV, PDF, and DOCX file formats
 * @param filePath - Optional path to document file (default from config)
 * @param clientId - Optional client ID prefix for multi-tenant collection naming
 */
export async function getRetriever(filePath?: string, clientId?: string) {
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

  // When called from the watcher, files live in the watch folder (external to the project).
  // Use the watch folder as the allowed base; otherwise restrict to the project root.
  const allowedBaseDir = clientId ? config.watcher.watchFolder : projectRootDir;

  // Validate file path to prevent directory traversal attacks
  const validatedPath = validateFilePath(docPath, allowedBaseDir);

  // Derive the collection name from the file path (no document loading yet)
  // Format: {clientId}_{fileType}_{fileName} or {fileType}_{fileName} if no clientId
  // This ensures multi-tenant isolation: each client's files get separate collections
  const fileType = detectFileType(validatedPath);
  const fileName = path.basename(validatedPath, path.extname(validatedPath));
  // Sanitize the file-based suffix with lowercase normalization
  const sanitizedSuffix = `${fileType}_${fileName}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
  // Sanitize the clientId (userId) without lowercasing, to preserve its original casing
  const sanitizedClientId = clientId
    ? clientId.replace(/[^a-zA-Z0-9_]/g, "_")
    : null;
  const collectionName = (sanitizedClientId
    ? `${sanitizedClientId}_${sanitizedSuffix}`
    : sanitizedSuffix
  ).substring(0, 63); // ChromaDB collection name limit

  console.log(`Using collection: ${collectionName}`);
  console.log(`Source file: ${validatedPath}`);

  // Initialize the embedding model (converts text to numerical vectors)
  const embeddings = new OllamaEmbeddings(config.embeddings);

  // Create ChromaDB config with the file-specific collection name
  const chromaConfig = {
    ...config.chroma,
    collectionName: collectionName,
  };

  console.log("Creating/connecting to vector database...");
  console.log(`Config ChromaDB: ${JSON.stringify(chromaConfig)}`);

  // Single responsibility: resolve (find or create + populate) the vector store.
  // Extracting this into its own function gives TypeScript a single, unambiguous
  // return point — no mutable variable, no non-null assertions needed.
  const vectorStore = await resolveVectorStore(embeddings, chromaConfig, validatedPath);

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

/**
 * List all collection names present in ChromaDB for the configured tenant and database.
 */
export async function listCollections(): Promise<string[]> {
  const configService = ConfigService.getInstance(import.meta.url);
  const config = configService.getConfig();
  const { url, tenant, database } = config.chroma;
  const params = new URLSearchParams({ tenant, database });
  const response = await fetch(`${url}/api/v1/collections?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to list collections: ${response.status} ${response.statusText}`);
  }
  const collections = (await response.json()) as { name: string }[];
  return collections.map((c) => c.name).sort();
}

/**
 * Connect to an existing ChromaDB collection by name and return a retriever.
 * Does NOT load or embed any documents — the collection must already exist.
 * @param collectionName - Exact ChromaDB collection name
 */
export async function getRetrieverByCollectionName(collectionName: string) {
  const configService = ConfigService.getInstance(import.meta.url);
  const config = configService.getConfig();
  const embeddings = new OllamaEmbeddings(config.embeddings);
  const chromaConfig = {
    ...config.chroma,
    collectionName,
  };
  console.log(`Connecting to collection: ${collectionName}`);
  const vectorStore = await PatchedChroma.fromExistingCollection(embeddings, chromaConfig);
  return vectorStore.asRetriever({ k: 50, searchType: "similarity" });
}

/**
 * Extracts the clientId prefix from a ChromaDB collection name.
 *
 * Collection names are formatted as:
 *   - `{clientId}_{fileType}_{fileName}` (with clientId)
 *   - `{fileType}_{fileName}`             (without clientId)
 *
 * Returns `null` when the name has no clientId prefix (i.e. it starts
 * directly with a known file type followed by `_`).
 *
 * @param collectionName - The full ChromaDB collection name
 * @returns The clientId string, or null if none is present
 */
export function extractClientId(collectionName: string): string | null {
  for (const fileType of KNOWN_FILE_TYPES) {
    // No clientId: name starts with "{fileType}_"
    if (collectionName.startsWith(`${fileType}_`)) {
      return null;
    }
    // Has clientId: name contains "_{fileType}_" somewhere after position 0
    const marker = `_${fileType}_`;
    const idx = collectionName.indexOf(marker);
    if (idx > 0) {
      return collectionName.substring(0, idx);
    }
  }
  // No known file-type segment found — treat as standalone
  return null;
}

/**
 * Returns all collection names from `allCollections` that share the same clientId.
 * Includes the originally selected collection.
 *
 * @param clientId      - The clientId prefix to match
 * @param allCollections - Full list of collection names from ChromaDB
 * @returns Filtered list of collection names belonging to that clientId
 */
export function getCollectionsByClientId(
  clientId: string,
  allCollections: string[]
): string[] {
  return allCollections.filter(
    (name) => extractClientId(name) === clientId
  );
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
