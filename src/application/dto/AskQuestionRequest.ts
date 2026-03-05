/**
 * AskQuestionRequest DTO - Application Layer
 * Data transfer object for question requests
 */

export class AskQuestionRequest {
  constructor(
    readonly question: string,
    readonly clientId?: string,
    readonly sessionId?: string,
    readonly collectionName?: string
  ) {}

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.question || this.question.trim().length === 0) {
      errors.push("Question cannot be empty");
    }

    if (this.question && this.question.length > 5000) {
      errors.push("Question exceeds maximum length of 5000 characters");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
