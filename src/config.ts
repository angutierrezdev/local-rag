import { readFileSync } from "fs";
import { AppConfig, PromptsConfig } from "./types.js";
import { resolveFromRoot } from "./utils/paths.js";

/**
 * ConfigService singleton - manages all application configuration
 * Loads and validates configuration from environment variables and files
 */
export class ConfigService {
  private static instance: ConfigService | null = null;
  private config: AppConfig | null = null;
  private importMetaUrl: string | null = null;

  private constructor(importMetaUrl: string) {
    this.importMetaUrl = importMetaUrl;
  }

  /**
   * Get or create the singleton instance
   * @param importMetaUrl - The import.meta.url from the module calling this
   * @returns The ConfigService singleton instance
   */
  static getInstance(importMetaUrl: string): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService(importMetaUrl);
    }
    return ConfigService.instance;
  }

  /**
   * Reset the singleton (mainly for testing)
   */
  static reset(): void {
    ConfigService.instance = null;
  }

  /**
   * Load and validate all configuration
   * @returns The complete AppConfig
   */
  getConfig(): AppConfig {
    if (this.config) {
      return this.config;
    }

    if (!this.importMetaUrl) {
      throw new Error("ConfigService not properly initialized");
    }

    // Load prompts configuration from file
    const promptsConfig = this.loadPromptsConfig();

    // Build the complete configuration
    this.config = {
      ollama: {
        baseUrl: this.getRequired("OLLAMA_BASE_URL"),
        model: this.getRequired("OLLAMA_MODEL"),
      },
      embeddings: {
        baseUrl: this.getOptional("OLLAMA_BASE_URL", "http://localhost:11434"),
        model: this.getOptional(
          "OLLAMA_EMBEDDING_MODEL",
          "mxbai-embed-large"
        ),
      },
      chroma: {
        url: this.getOptional("CHROMA_URL", "http://localhost:8000"),
        collectionName: this.getOptional(
          "CHROMA_COLLECTION_NAME",
          "restaurant_reviews_ts"
        ),
        tenant: this.getOptional("CHROMA_TENANT", "default_tenant"),
        database: this.getOptional("CHROMA_DATABASE", "default_database"),
      },
      csv: {
        filePath: this.getOptional(
          "CSV_FILE_PATH",
          "data/realistic_restaurant_reviews.csv"
        ),
      },
      prompts: promptsConfig,
      chatWindowSize: parseInt(
        this.getOptional("CHAT_WINDOW_SIZE", "10"),
        10
      ),
      debug: {
        vectorTest: process.env.DEBUG_VECTOR_TEST === "true",
      },
    };

    return this.config;
  }

  /**
   * Get Ollama LLM configuration
   */
  getOllamaConfig() {
    return this.getConfig().ollama;
  }

  /**
   * Get Ollama embeddings configuration
   */
  getEmbeddingsConfig() {
    return this.getConfig().embeddings;
  }

  /**
   * Get ChromaDB configuration
   */
  getChromaConfig() {
    return this.getConfig().chroma;
  }

  /**
   * Get CSV configuration
   */
  getCsvConfig() {
    return this.getConfig().csv;
  }

  /**
   * Get prompts configuration
   */
  getPromptsConfig() {
    return this.getConfig().prompts;
  }

  /**
   * Get debug settings
   */
  getDebugConfig() {
    return this.getConfig().debug;
  }

  /**
   * Get a required environment variable
   * @throws Error if the variable is not set
   */
  private getRequired(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(
        `Missing required environment variable: ${key}`
      );
    }
    return value;
  }

  /**
   * Get an optional environment variable with a default value
   */
  private getOptional(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }

  /**
   * Load and validate prompts configuration from JSON file
   */
  private loadPromptsConfig(): PromptsConfig {
    if (!this.importMetaUrl) {
      throw new Error("ConfigService not properly initialized");
    }

    const promptsConfigPath = this.getOptional(
      "PROMPTS_CONFIG_PATH",
      "prompts/default.json"
    );

    try {
      const fullPath = resolveFromRoot(
        promptsConfigPath,
        this.importMetaUrl
      );
      const content = readFileSync(fullPath, "utf-8");
      const config = JSON.parse(content);

      // Validate required fields
      if (!config.template || typeof config.template !== "string") {
        throw new Error(
          `Invalid prompts config at ${fullPath}: missing or invalid 'template' field`
        );
      }

      return config as PromptsConfig;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Invalid prompts config")) {
        throw error;
      }
      throw new Error(
        `Failed to load prompts configuration from ${promptsConfigPath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
