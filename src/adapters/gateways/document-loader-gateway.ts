/**
 * DocumentLoaderGateway Adapter - Interface Adapters Layer
 * Implements IDocumentLoader using strategy pattern for different file types
 */

import type { Document } from "@langchain/core/documents";
import type { IDocumentLoader } from '../../application/ports/document-loader.js';
import type { ILogger } from '../../application/ports/logger.js';
import { loadDocuments } from '../../loaders/document-loader.js';
import * as fs from "fs";
import * as path from "path";

interface LoaderStrategy {
  load(filePath: string): Promise<Document[]>;
  getSupportedTypes(): string[];
  getName(): string;
}

export class DocumentLoaderGateway implements IDocumentLoader {
  private loaders: Map<string, LoaderStrategy> = new Map();

  constructor(private logger: ILogger) {
    this.registerDefaultLoaders();
  }

  private registerDefaultLoaders(): void {
    // PDF Loader
    this.loaders.set("pdf", {
      load: async (filePath: string) => {
        this.logger.debug("Loading PDF", { filePath });
        return loadDocuments(filePath);
      },
      getSupportedTypes: () => ["pdf"],
      getName: () => "PDFLoader",
    });

    // TXT Loader
    this.loaders.set("txt", {
      load: async (filePath: string) => {
        this.logger.debug("Loading TXT", { filePath });
        return loadDocuments(filePath);
      },
      getSupportedTypes: () => ["txt"],
      getName: () => "TextLoader",
    });

    // CSV Loader
    this.loaders.set("csv", {
      load: async (filePath: string) => {
        this.logger.debug("Loading CSV", { filePath });
        return loadDocuments(filePath);
      },
      getSupportedTypes: () => ["csv"],
      getName: () => "CSVLoader",
    });

    // DOCX Loader
    this.loaders.set("docx", {
      load: async (filePath: string) => {
        this.logger.debug("Loading DOCX", { filePath });
        return loadDocuments(filePath);
      },
      getSupportedTypes: () => ["docx"],
      getName: () => "DocxLoader",
    });
  }

  async load(filePath: string): Promise<Document[]> {
    try {
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const ext = this.getFileExtension(filePath);
      const loader = this.loaders.get(ext);

      if (!loader) {
        throw new Error(
          `No loader found for file type: ${ext}. Supported types: ${this.getSupportedFileTypes().join(", ")}`
        );
      }

      this.logger.info("Loading documents", { filePath, fileType: ext });
      const documents = await loader.load(filePath);
      this.logger.info("Documents loaded successfully", {
        filePath,
        documentCount: documents.length,
      });

      return documents;
    } catch (error) {
      this.logger.error("Error loading documents", error as Error, {
        filePath,
      });
      throw error;
    }
  }

  getSupportedFileTypes(): string[] {
    const types = new Set<string>();
    this.loaders.forEach((loader) => {
      loader.getSupportedTypes().forEach((type) => types.add(type));
    });
    return Array.from(types);
  }

  isSupported(filePath: string): boolean {
    const ext = this.getFileExtension(filePath);
    return this.loaders.has(ext);
  }

  getName(): string {
    return "DocumentLoaderGateway";
  }

  registerLoader(strategy: LoaderStrategy, fileType: string): void {
    this.loaders.set(fileType, strategy);
    this.logger.debug("Registered new loader", {
      fileType,
      loaderName: strategy.getName(),
    });
  }

  private getFileExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return ext.startsWith(".") ? ext.substring(1) : ext;
  }
}
