/**
 * IConfiguration Port - Application Layer Contract
 * Abstraction for configuration retrieval
 */

export interface IConfiguration {
  /**
   * Gets the Ollama base URL
   */
  getOllamaBaseUrl(): string;

  /**
   * Gets the Ollama model name
   */
  getOllamaModel(): string;

  /**
   * Gets the Chroma host
   */
  getChromaHost(): string;

  /**
   * Gets the Chroma port
   */
  getChromaPort(): number;

  /**
   * Gets the base path for data storage
   */
  getBasePath(): string;

  /**
   * Gets the default data directory
   */
  getDefaultDataDir(): string;

  /**
   * Gets the default prompts directory
   */
  getDefaultPromptsDir(): string;

  /**
   * Gets a prompt template by name
   */
  getPrompt(name: string): string;

  /**
   * Gets all available prompts
   */
  getAvailablePrompts(): string[];

  /**
   * Gets a configuration value by key with optional default
   */
  get(key: string, defaultValue?: any): any;

  /**
   * Sets a configuration value
   */
  set(key: string, value: any): void;

  /**
   * Checks if a configuration key exists
   */
  has(key: string): boolean;

  /**
   * Gets all configuration as an object
   */
  getAll(): Record<string, any>;
}
