/**
 * IVectorStore Port - Application Layer Contract
 * Abstraction for vector database implementations (Chroma, Pinecone, etc)
 */

import type { Document } from "@langchain/core/documents";

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  includeMetadata?: boolean;
}

export interface IVectorStore {
  /**
   * Searches for documents similar to the query
   * @param query - The search query text
   * @param options - Search options (limit, min score, etc)
   * @returns Array of similar documents
   */
  search(query: string, options?: SearchOptions): Promise<Document[]>;

  /**
   * Searches using a vector directly
   * @param embedding - The query embedding vector
   * @param options - Search options
   */
  searchByEmbedding(
    embedding: number[],
    options?: SearchOptions
  ): Promise<Document[]>;

  /**
   * Adds documents to the vector store
   * @param documents - Documents to add
   * @param collectionName - Name of the collection to add to
   */
  addDocuments(documents: Document[], collectionName: string): Promise<void>;

  /**
   * Deletes documents from the store
   * @param documentIds - IDs of documents to delete
   * @param collectionName - Collection to delete from
   */
  deleteDocuments(documentIds: string[], collectionName: string): Promise<void>;

  /**
   * Gets information about all collections
   */
  listCollections(): Promise<string[]>;

  /**
   * Deletes an entire collection
   * @param collectionName - Name of collection to delete
   */
  deleteCollection(collectionName: string): Promise<void>;

  /**
   * Gets document count in a collection
   */
  getCollectionSize(collectionName: string): Promise<number>;

  /**
   * Checks if a collection exists
   */
  collectionExists(collectionName: string): Promise<boolean>;
}
