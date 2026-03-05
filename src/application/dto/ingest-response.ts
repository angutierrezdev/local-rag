/**
 * IngestResponse DTO - Application Layer
 * Data transfer object for document ingestion responses
 */

export class IngestResponse {
  constructor(
    readonly collectionName: string,
    readonly documentCount: number,
    readonly ingestTime: number, // in milliseconds
    readonly clientId?: string,
    readonly successfulDocuments: number = documentCount,
    readonly failedDocuments: number = 0
  ) {}

  toJSON(): Record<string, any> {
    return {
      collectionName: this.collectionName,
      clientId: this.clientId,
      documentCount: this.documentCount,
      successfulDocuments: this.successfulDocuments,
      failedDocuments: this.failedDocuments,
      ingestTime: this.ingestTime,
    };
  }

  wasSuccessful(): boolean {
    return this.failedDocuments === 0 && this.documentCount > 0;
  }

  getSuccessRate(): number {
    const total = this.successfulDocuments + this.failedDocuments;
    return total === 0 ? 0 : (this.successfulDocuments / total) * 100;
  }
}
