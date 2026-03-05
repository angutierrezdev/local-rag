/**
 * DocumentIngestionPolicy Domain Service
 * Enforces rules for document ingestion (file types, sizes, etc)
 */

export interface SupportedFileType {
  extension: string;
  mimeType: string;
  maxSizeBytes: number;
}

export class DocumentIngestionPolicy {
  private supportedTypes: Map<string, SupportedFileType>;
  private maxTotalFileSizeBytes = 1024 * 1024 * 500; // 500 MB default

  constructor() {
    this.supportedTypes = new Map([
      ["pdf", { extension: "pdf", mimeType: "application/pdf", maxSizeBytes: 1024 * 1024 * 50 }], // 50 MB
      ["txt", { extension: "txt", mimeType: "text/plain", maxSizeBytes: 1024 * 1024 * 10 }], // 10 MB
      ["docx", { extension: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", maxSizeBytes: 1024 * 1024 * 25 }], // 25 MB
      ["csv", { extension: "csv", mimeType: "text/csv", maxSizeBytes: 1024 * 1024 * 50 }], // 50 MB
    ]);
  }

  /**
   * Validates if a file type is supported
   */
  isSupportedFileType(filePath: string): boolean {
    const extension = this.extractFileExtension(filePath);
    return this.supportedTypes.has(extension.toLowerCase());
  }

  /**
   * Gets supported file types
   */
  getSupportedFileTypes(): string[] {
    return Array.from(this.supportedTypes.keys());
  }

  /**
   * Validates file size
   */
  isValidFileSize(filePath: string, fileSizeBytes: number): boolean {
    const extension = this.extractFileExtension(filePath).toLowerCase();
    const fileType = this.supportedTypes.get(extension);

    if (!fileType) {
      return false;
    }

    return fileSizeBytes <= fileType.maxSizeBytes;
  }

  /**
   * Validates total batch size
   */
  isValidTotalSize(totalSizeBytes: number): boolean {
    return totalSizeBytes <= this.maxTotalFileSizeBytes;
  }

  /**
   * Sets custom max file size for a type
   */
  setMaxFileSizeForType(extension: string, maxSizeBytes: number): void {
    const lowerExt = extension.toLowerCase();
    const fileType = this.supportedTypes.get(lowerExt);

    if (!fileType) {
      throw new Error(`File type ${extension} is not supported`);
    }

    fileType.maxSizeBytes = maxSizeBytes;
  }

  /**
   * Sets custom max total size
   */
  setMaxTotalSize(maxSizeBytes: number): void {
    this.maxTotalFileSizeBytes = maxSizeBytes;
  }

  /**
   * Adds a new supported file type
   */
  addSupportedFileType(
    extension: string,
    mimeType: string,
    maxSizeBytes: number
  ): void {
    this.supportedTypes.set(extension.toLowerCase(), {
      extension: extension.toLowerCase(),
      mimeType,
      maxSizeBytes,
    });
  }

  private extractFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf(".");
    if (lastDot === -1) {
      return "";
    }
    return filePath.substring(lastDot + 1);
  }
}
