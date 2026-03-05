/**
 * ConfigurationAdapter - Interface Adapters Layer
 * Implements IConfiguration using the existing ConfigService
 */

import type { IConfiguration } from '../../application/ports/configuration.js';
import { ConfigService } from "../../config.js";
import type { AppConfig } from "../../types.js";

export class ConfigurationAdapter implements IConfiguration {
  private configService: ConfigService;
  private config: AppConfig;

  constructor(importMetaUrl: string) {
    this.configService = ConfigService.getInstance(importMetaUrl);
    this.config = this.configService.getConfig();
  }

  getOllamaBaseUrl(): string {
    return this.config.ollama.baseUrl;
  }

  getOllamaModel(): string {
    return this.config.ollama.model;
  }

  getChromaHost(): string {
    // Parse host from URL
    try {
      const url = new URL(this.config.chroma.url);
      return url.hostname;
    } catch {
      return "localhost";
    }
  }

  getChromaPort(): number {
    // Parse port from URL
    try {
      const url = new URL(this.config.chroma.url);
      return parseInt(url.port) || 8000;
    } catch {
      return 8000;
    }
  }

  getBasePath(): string {
    return process.cwd();
  }

  getDefaultDataDir(): string {
    return this.config.csv.filePath;
  }

  getDefaultPromptsDir(): string {
    return "./prompts";
  }

  getPrompt(name: string): string {
    const prompts = this.config.prompts;
    const prompt = prompts[name as keyof typeof prompts];
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }
    return prompt;
  }

  getAvailablePrompts(): string[] {
    return Object.keys(this.config.prompts);
  }

  get(key: string, defaultValue?: any): any {
    const keys = key.split(".");
    let value: any = this.config;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  set(key: string, value: any): void {
    const keys = key.split(".");
    let current: any = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current)) {
        current[k] = {};
      }
      current = current[k];
    }

    current[keys[keys.length - 1]] = value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  getAll(): Record<string, any> {
    return JSON.parse(JSON.stringify(this.config));
  }
}
