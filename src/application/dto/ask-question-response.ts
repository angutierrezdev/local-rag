/**
 * AskQuestionResponse DTO - Application Layer
 * Data transfer object for question responses
 */

import type { Document } from "@langchain/core/documents";

export class AskQuestionResponse {
  constructor(
    readonly answer: string,
    readonly sourceDocuments: Document[],
    readonly responseTime: number, // in milliseconds
    readonly questionId?: string,
    readonly sessionId?: string
  ) {}

  toJSON(): Record<string, any> {
    return {
      answer: this.answer,
      sources: this.sourceDocuments.map((doc) => ({
        content: doc.pageContent,
        metadata: doc.metadata,
      })),
      responseTime: this.responseTime,
      questionId: this.questionId,
      sessionId: this.sessionId,
    };
  }

  hasSourceDocuments(): boolean {
    return this.sourceDocuments && this.sourceDocuments.length > 0;
  }

  getFormattedAnswer(): string {
    return this.answer.trim();
  }

  getSourceCount(): number {
    return this.sourceDocuments?.length || 0;
  }
}
