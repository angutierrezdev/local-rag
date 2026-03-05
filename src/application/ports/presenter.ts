/**
 * IPresenter Port - Application Layer Contract
 * Abstraction for output presentation
 */

import type { RagResponse } from "../../domain/entities/rag-response.js";

export interface IPresenter {
  /**
   * Formats a RAG response for presentation
   */
  format(response: RagResponse): string;

  /**
   * Formats an error for presentation
   */
  formatError(error: Error): string;

  /**
   * Formats a status/informational message
   */
  formatMessage(message: string): string;

  /**
   * Gets the output format type
   */
  getFormat(): string;
}
