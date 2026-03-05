/**
 * IEmbeddings Port - Application Layer Contract
 * Abstraction for embedding model implementations (Ollama, OpenAI, etc)
 */

export interface IEmbeddings {
  /**
   * Embeds a single text string
   * @param text - The text to embed
   * @returns Vector representation of the text
   */
  embedText(text: string): Promise<number[]>;

  /**
   * Embeds multiple text strings
   * @param texts - Array of texts to embed
   * @returns Array of vector representations
   */
  embedTexts(texts: string[]): Promise<number[][]>;

  /**
   * Gets the dimensionality of the embedding vectors
   */
  getEmbeddingDimension(): number;

  /**
   * Gets model information/metadata
   */
  getModelInfo(): Record<string, any>;

  /**
   * Calculates similarity between two embeddings (0-1)
   */
  similarity(embedding1: number[], embedding2: number[]): number;
}
