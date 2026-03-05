/**
 * EmbeddingScore Value Object - Domain Value Object
 * Type-safe wrapper around embedding similarity score (0-1 range)
 */

export class EmbeddingScore {
  readonly value: number;

  constructor(value: number) {
    this.validateScore(value);
    this.value = value;
  }

  private validateScore(value: number): void {
    if (typeof value !== "number" || isNaN(value)) {
      throw new Error("EmbeddingScore must be a valid number");
    }

    if (value < 0 || value > 1) {
      throw new Error("EmbeddingScore must be between 0 and 1");
    }
  }

  isHighConfidence(threshold: number = 0.7): boolean {
    return this.value >= threshold;
  }

  isMediumConfidence(threshold: number = 0.5): boolean {
    return this.value >= threshold && this.value < 0.7;
  }

  isLowConfidence(threshold: number = 0.3): boolean {
    return this.value >= threshold && this.value < 0.5;
  }

  equals(other: EmbeddingScore, tolerance: number = 0.0001): boolean {
    return Math.abs(this.value - other.value) <= tolerance;
  }

  compareTo(other: EmbeddingScore): number {
    if (this.value < other.value) return -1;
    if (this.value > other.value) return 1;
    return 0;
  }

  toString(): string {
    return this.value.toFixed(4);
  }

  static create(value: number): EmbeddingScore {
    return new EmbeddingScore(value);
  }
}

