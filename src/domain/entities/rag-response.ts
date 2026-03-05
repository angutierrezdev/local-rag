/**
 * RagResponse Entity - Domain Core
 * Represents the complete response from the RAG system
 */

import type { Document } from "@langchain/core/documents";

export interface IRagResponse {
  readonly answer: string;
  readonly sourceDocuments: Document[];
  readonly timestamp: Date;
  readonly questionId?: string;
}

export class RagResponse implements IRagResponse {
  readonly answer: string;
  readonly sourceDocuments: Document[];
  readonly timestamp: Date;
  readonly questionId?: string;

  constructor(
    answer: string,
    sourceDocuments: Document[],
    questionId?: string,
    timestamp?: Date
  ) {
    this.validateAnswer(answer);
    this.answer = answer;
    this.sourceDocuments = sourceDocuments;
    this.questionId = questionId;
    this.timestamp = timestamp || new Date();
  }

  private validateAnswer(answer: string): void {
    if (!answer || answer.trim().length === 0) {
      throw new Error("Answer cannot be empty");
    }
  }

  hasSourceDocuments(): boolean {
    return this.sourceDocuments && this.sourceDocuments.length > 0;
  }

  getSourceCount(): number {
    return this.sourceDocuments?.length || 0;
  }

  getFormattedAnswer(): string {
    return this.answer.trim();
  }
}
