/**
 * IDocumentLoader Port - Application Layer Contract
 * Abstraction for document loading implementations (PDF, DOCX, CSV, TXT)
 */

import type { Document } from "@langchain/core/documents";

export interface IDocumentLoader {
  /**
   * Loads documents from a file
   * @param filePath - Path to the file to load
   * @returns Array of loaded documents
   */
  load(filePath: string): Promise<Document[]>;

  /**
   * Gets array of supported file extensions
   */
  getSupportedFileTypes(): string[];

  /**
   * Checks if a file type is supported
   */
  isSupported(filePath: string): boolean;

  /**
   * Gets file loader friendly name
   */
  getName(): string;
}
