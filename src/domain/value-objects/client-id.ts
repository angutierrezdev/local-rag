/**
 * ClientId Value Object - Domain Value Object
 * Type-safe wrapper around client identifier string
 */

export class ClientId {
  readonly value: string;

  constructor(value: string) {
    this.validateClientId(value);
    this.value = value;
  }

  private validateClientId(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error("ClientId cannot be empty");
    }

    if (value.length > 256) {
      throw new Error("ClientId cannot exceed 256 characters");
    }
  }

  equals(other: ClientId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  static create(value: string): ClientId {
    return new ClientId(value);
  }
}

