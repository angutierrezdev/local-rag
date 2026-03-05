/**
 * Question Entity - Domain Core
 * Represents a user's question with validation rules
 */

export interface IQuestion {
  readonly text: string;
  readonly timestamp: Date;
  readonly clientId?: string;
}

export class Question implements IQuestion {
  readonly text: string;
  readonly timestamp: Date;
  readonly clientId?: string;

  constructor(text: string, clientId?: string, timestamp?: Date) {
    this.validateQuestion(text);
    this.text = text;
    this.clientId = clientId;
    this.timestamp = timestamp || new Date();
  }

  private validateQuestion(text: string): void {
    if (!text || text.trim().length === 0) {
      throw new Error("Question cannot be empty");
    }

    if (text.length > 5000) {
      throw new Error("Question exceeds maximum length of 5000 characters");
    }
  }

  isSanitized(): boolean {
    // Check for common SQL injection patterns
    const suspiciousPatterns = /('|(--)|;|(")|(\*)|(\||&))/gi;
    return !suspiciousPatterns.test(this.text);
  }

  getLength(): number {
    return this.text.length;
  }

  isEmpty(): boolean {
    return this.text.trim().length === 0;
  }
}
