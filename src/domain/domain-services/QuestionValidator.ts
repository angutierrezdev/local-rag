/**
 * QuestionValidator Domain Service
 * Validates question according to domain rules
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export class QuestionValidator {
  private minLength: number = 1;
  private maxLength: number = 5000;

  validate(question: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!question) {
      errors.push({
        field: "question",
        message: "Question cannot be empty",
      });
      return { valid: false, errors };
    }

    const trimmed = question.trim();

    if (trimmed.length < this.minLength) {
      errors.push({
        field: "question",
        message: `Question must be at least ${this.minLength} character long`,
      });
    }

    if (trimmed.length > this.maxLength) {
      errors.push({
        field: "question",
        message: `Question cannot exceed ${this.maxLength} characters`,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  setLengthConstraints(minLength: number, maxLength: number): void {
    if (minLength < 0) {
      throw new Error("Minimum length cannot be negative");
    }
    if (maxLength <= minLength) {
      throw new Error("Maximum length must be greater than minimum length");
    }
    this.minLength = minLength;
    this.maxLength = maxLength;
  }
}
