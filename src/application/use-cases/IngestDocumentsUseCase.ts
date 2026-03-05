/**
 * IngestDocumentsUseCase - Application Layer
 * Use case for ingesting documents into the vector store
 */

import type { IDocumentLoader } from "../ports/IDocumentLoader.js";
import type { IVectorStore } from "../ports/IVectorStore.js";
import type { ILogger } from "../ports/ILogger.js";
import { IngestRequest } from "../dto/IngestRequest.js";
import { IngestResponse } from "../dto/IngestResponse.js";
import { DocumentIngestionPolicy } from "../../domain/domain-services/DocumentIngestionPolicy.js";
import { MultiTenancyPolicy } from "../../domain/domain-services/MultiTenancyPolicy.js";

export class IngestDocumentsUseCase {
  private documentIngestionPolicy = new DocumentIngestionPolicy();
  private multiTenancyPolicy = new MultiTenancyPolicy();

  constructor(
    private documentLoader: IDocumentLoader,
    private vectorStore: IVectorStore,
    private logger: ILogger
  ) {}

  async execute(request: IngestRequest): Promise<IngestResponse> {
    const startTime = Date.now();

    try {
      // Validate request
      const validation = request.validate();
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      // Validate file type is supported
      if (!this.documentLoader.isSupported(request.filePath)) {
        throw new Error(
          `File type not supported. Supported types: ${this.documentLoader.getSupportedFileTypes().join(", ")}`
        );
      }

      this.logger.debug("Ingesting documents", {
        filePath: request.filePath,
        clientId: request.clientId,
      });

      // Load documents
      const documents = await this.documentLoader.load(request.filePath);

      if (documents.length === 0) {
        throw new Error("No documents extracted from file");
      }

      // Apply multi-tenancy isolation
      const collectionName = request.collectionName
        ? this.multiTenancyPolicy.generateCollectionName(
            request.clientId || "default",
            request.collectionName
          )
        : this.multiTenancyPolicy.generateCollectionName(
            request.clientId || "default",
            "documents"
          );

      // Add metadata to documents
      const enhancedDocuments = documents.map((doc) => ({
        ...doc,
        metadata: {
          ...doc.metadata,
          clientId: request.clientId,
          sourceFile: request.filePath,
          ingestedAt: new Date().toISOString(),
        },
      }));

      // Add to vector store
      await this.vectorStore.addDocuments(enhancedDocuments, collectionName);

      const ingestTime = Date.now() - startTime;

      this.logger.info("Documents ingested successfully", {
        collectionName,
        documentCount: documents.length,
        ingestTime,
      });

      return new IngestResponse(
        collectionName,
        documents.length,
        ingestTime,
        request.clientId,
        documents.length,
        0
      );
    } catch (error) {
      const ingestTime = Date.now() - startTime;
      this.logger.error("Failed to ingest documents", error as Error, {
        filePath: request.filePath,
        clientId: request.clientId,
        ingestTime,
      });
      throw error;
    }
  }
}
