/**
 * OllamaLLMGateway Adapter - Interface Adapters Layer
 * Implements ILanguageModel using Ollama
 */

import { Ollama } from "@langchain/ollama";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import type { Runnable } from "@langchain/core/runnables";
import type { ILanguageModel } from '../../application/ports/language-model.js';
import type { ILogger } from '../../application/ports/logger.js';
import type { IConfiguration } from '../../application/ports/configuration.js';

export class OllamaLLMGateway implements ILanguageModel {
  private chain!: RunnableWithMessageHistory<Record<string, string>, string>;
  private ollama: Ollama;

  constructor(
    private configuration: IConfiguration,
    private messageHistory: any,
    private logger: ILogger
  ) {
    const baseUrl = this.configuration.getOllamaBaseUrl();
    const model = this.configuration.getOllamaModel();

    this.ollama = new Ollama({
      baseUrl,
      model,
    });

    this.initializeChain();
  }

  private initializeChain(): void {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "You are a helpful assistant. Answer questions based on the provided context.",
      ],
      new MessagesPlaceholder("history"),
      ["human", "{input}"],
    ]);

    this.chain = new RunnableWithMessageHistory({
      runnable: prompt.pipe(this.ollama),
      getMessageHistory: () => this.messageHistory,
      inputMessagesKey: "input",
      historyMessagesKey: "history",
    });

    this.logger.debug("OllamaLLMGateway initialized", {
      baseUrl: this.configuration.getOllamaBaseUrl(),
      model: this.configuration.getOllamaModel(),
    });
  }

  async invoke(prompt: string, context?: Record<string, any>): Promise<string> {
    try {
      const result = await this.ollama.invoke(prompt);
      return typeof result === "string" ? result : (result as any).content || String(result);
    } catch (error) {
      this.logger.error("Error invoking Ollama", error as Error);
      throw error;
    }
  }

  async invokeWithInput(input: Record<string, string>): Promise<string> {
    try {
      const result = await this.chain.invoke(input, {
        configurable: { sessionId: "default" },
      });
      return typeof result === "string" ? result : (result as any).content || String(result);
    } catch (error) {
      this.logger.error("Error invoking chain", error as Error);
      throw error;
    }
  }

  supportsStreaming(): boolean {
    return false; // Can be extended to support streaming
  }

  async streamInvoke(
    prompt: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    throw new Error("Streaming not yet implemented");
  }

  getModelInfo(): Record<string, any> {
    return {
      type: "ollama",
      baseUrl: this.configuration.getOllamaBaseUrl(),
      model: this.configuration.getOllamaModel(),
    };
  }
}
