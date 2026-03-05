/**
 * OllamaEmbeddingsGateway Adapter - Interface Adapters Layer
 * Implements IEmbeddings using Ollama
 */

import { OllamaEmbeddings } from "@langchain/ollama";
import type { IEmbeddings } from "../../application/ports/IEmbeddings.js";
import type { ILogger } from "../../application/ports/ILogger.js";
import type { IConfiguration } from "../../application/ports/IConfiguration.js";

export class OllamaEmbeddingsGateway implements IEmbeddings {
  private embeddings: OllamaEmbeddings;
  private embeddingDimension = 384; // Default for nomic-embed-text

  constructor(
    private configuration: IConfiguration,
    private logger: ILogger
  ) {
    const baseUrl = this.configuration.getOllamaBaseUrl();

    this.embeddings = new OllamaEmbeddings({
      baseUrl,
      model: "nomic-embed-text",
    });

    this.logger.debug("OllamaEmbeddingsGateway initialized", {
      baseUrl,
      model: "nomic-embed-text",
    });
  }

  async embedText(text: string): Promise<number[]> {
    try {
      this.logger.debug("Embedding text", {
        textLength: text.length,
      });

      const result = await this.embeddings.embedQuery(text);
      return result;
    } catch (error) {
      this.logger.error("Error embedding text", error as Error);
      throw error;
    }
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    try {
      this.logger.debug("Embedding multiple texts", {
        count: texts.length,
      });

      const results = await this.embeddings.embedDocuments(texts);
      return results;
    } catch (error) {
      this.logger.error("Error embedding texts", error as Error);
      throw error;
    }
  }

  getEmbeddingDimension(): number {
    return this.embeddingDimension;
  }

  getModelInfo(): Record<string, any> {
    return {
      type: "ollama",
      model: "nomic-embed-text",
      dimension: this.embeddingDimension,
      baseUrl: this.configuration.getOllamaBaseUrl(),
    };
  }

  similarity(embedding1: number[], embedding2: number[]): number {
    // Cosine similarity
    if (embedding1.length !== embedding2.length) {
      throw new Error("Embedding vectors must have the same length");
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }
}
