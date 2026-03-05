/**
 * InMemoryHistoryGateway Adapter - Interface Adapters Layer
 * Implements IMessageHistory using in-memory storage
 */

import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import type { IMessageHistory, Message } from "../../application/ports/IMessageHistory.js";
import type { ILogger } from "../../application/ports/ILogger.js";

export class InMemoryHistoryGateway implements IMessageHistory {
  private messageHistory: InMemoryChatMessageHistory;
  private messages: Message[] = [];

  constructor(
    private logger: ILogger,
    private sessionId?: string
  ) {
    this.messageHistory = new InMemoryChatMessageHistory();
    this.logger.debug("InMemoryHistoryGateway initialized", {
      sessionId,
    });
  }

  async addMessage(
    role: "user" | "assistant" | "system",
    content: string
  ): Promise<void> {
    try {
      this.messages.push({
        role,
        content,
        timestamp: new Date(),
      });

      // Also add to LangChain history
      if (role === "user") {
        await this.messageHistory.addUserMessage(content);
      } else if (role === "assistant") {
        await this.messageHistory.addAIMessage(content);
      }

      this.logger.debug("Message added to history", {
        role,
        contentLength: content.length,
      });
    } catch (error) {
      this.logger.error("Error adding message", error as Error);
      throw error;
    }
  }

  async getMessages(): Promise<Message[]> {
    return [...this.messages];
  }

  async getRecentMessages(count: number): Promise<Message[]> {
    return this.messages.slice(Math.max(0, this.messages.length - count));
  }

  async clear(): Promise<void> {
    try {
      this.messages = [];
      this.messageHistory.clear();
      this.logger.debug("History cleared", { sessionId: this.sessionId });
    } catch (error) {
      this.logger.error("Error clearing history", error as Error);
      throw error;
    }
  }

  async getMessageCount(): Promise<number> {
    return this.messages.length;
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }

  async export(): Promise<string> {
    return JSON.stringify(this.messages, null, 2);
  }

  getLangChainHistory(): InMemoryChatMessageHistory {
    return this.messageHistory;
  }
}
