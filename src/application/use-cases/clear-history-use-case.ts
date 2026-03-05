/**
 * ClearHistoryUseCase - Application Layer
 * Use case for clearing conversation history
 */

import type { IMessageHistory } from '../../application/ports/message-history.js';
import type { ILogger } from '../../application/ports/logger.js';

export class ClearHistoryUseCase {
  constructor(
    private messageHistory: IMessageHistory,
    private logger: ILogger
  ) {}

  async execute(sessionId?: string): Promise<void> {
    try {
      this.logger.debug("Clearing message history", { sessionId });

      await this.messageHistory.clear();

      this.logger.info("History cleared successfully", { sessionId });
    } catch (error) {
      this.logger.error(
        "Failed to clear history",
        error as Error,
        { sessionId }
      );
      throw error;
    }
  }
}
