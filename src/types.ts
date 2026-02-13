/**
 * Configuration types for the RAG system
 */

/**
 * Ollama LLM configuration
 */
export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

/**
 * Ollama embeddings configuration
 */
export interface OllamaEmbeddingsConfig {
  baseUrl: string;
  model: string;
}

/**
 * ChromaDB vector store configuration
 */
export interface ChromaConfig {
  url: string;
  collectionName: string;
}

/**
 * CSV data loading configuration
 */
export interface CsvConfig {
  filePath: string;
}

/**
 * Prompts configuration loaded from JSON
 */
export interface PromptsConfig {
  template: string;
  question?: string;
}

/**
 * Combined application configuration
 */
export interface AppConfig {
  ollama: OllamaConfig;
  embeddings: OllamaEmbeddingsConfig;
  chroma: ChromaConfig;
  csv: CsvConfig;
  prompts: PromptsConfig;
  chatWindowSize: number;
  debug: {
    vectorTest: boolean;
  };
}

/**
 * Restaurant review data structure
 */
export interface RestaurantReview {
  Title: string;
  Date: string;
  Rating: number;
  Review: string;
}
