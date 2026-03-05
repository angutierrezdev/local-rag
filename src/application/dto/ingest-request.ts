/**
 * IngestRequest DTO - Application Layer
 * Data transfer object for document ingestion requests
 */

export class IngestRequest {
  constructor(
    readonly filePath: string,
    readonly clientId?: string,
    readonly collectionName?: string,
    readonly metadata?: Record<string, any>
  ) {}

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.filePath || this.filePath.trim().length === 0) {
      errors.push("File path cannot be empty");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
