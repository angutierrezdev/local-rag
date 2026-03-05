/**
 * RagServiceFactory - Dependency Injection Container
 * Assembles all dependencies and creates the RAG application components
 */

import type { ILanguageModel } from "../../application/ports/ILanguageModel.js";
import type { IVectorStore } from "../../application/ports/IVectorStore.js";
import type { IEmbeddings } from "../../application/ports/IEmbeddings.js";
import type { IMessageHistory } from "../../application/ports/IMessageHistory.js";
import type { IDocumentLoader } from "../../application/ports/IDocumentLoader.js";
import type { IConfiguration } from "../../application/ports/IConfiguration.js";
import type { ILogger } from "../../application/ports/ILogger.js";
import type { IPresenter } from "../../application/ports/IPresenter.js";

import { OllamaLLMGateway } from "../gateways/OllamaLLMGateway.js";
import { ChromaVectorGateway } from "../gateways/ChromaVectorGateway.js";
import { OllamaEmbeddingsGateway } from "../gateways/OllamaEmbeddingsGateway.js";
import { InMemoryHistoryGateway } from "../gateways/InMemoryHistoryGateway.js";
import { DocumentLoaderGateway } from "../gateways/DocumentLoaderGateway.js";
import { ConfigurationAdapter } from "../gateways/ConfigurationAdapter.js";
import { ConsoleLoggerAdapter } from "../gateways/ConsoleLoggerAdapter.js";
import { PresenterAdapter } from "../gateways/PresenterAdapter.js";

import { AskQuestionUseCase } from "../../application/use-cases/AskQuestionUseCase.js";
import { IngestDocumentsUseCase } from "../../application/use-cases/IngestDocumentsUseCase.js";
import { ClearHistoryUseCase } from "../../application/use-cases/ClearHistoryUseCase.js";

export interface RagServices {
  languageModel: ILanguageModel;
  vectorStore: IVectorStore;
  embeddings: IEmbeddings;
  messageHistory: IMessageHistory;
  documentLoader: IDocumentLoader;
  configuration: IConfiguration;
  logger: ILogger;
  presenter: IPresenter;
  askQuestionUseCase: AskQuestionUseCase;
  ingestDocumentsUseCase: IngestDocumentsUseCase;
  clearHistoryUseCase: ClearHistoryUseCase;
}

export class RagServiceFactory {
  static createServices(importMetaUrl: string): RagServices {
    // Create core infrastructure services
    const logger = new ConsoleLoggerAdapter();
    const configuration = new ConfigurationAdapter(importMetaUrl);

    logger.info("Initializing RAG services");

    // Create embeddings
    const embeddings = new OllamaEmbeddingsGateway(configuration, logger);

    // Create message history
    const messageHistory = new InMemoryHistoryGateway(logger, "default");

    // Create language model
    const languageModel = new OllamaLLMGateway(
      configuration,
      messageHistory,
      logger
    );

    // Create vector store
    const vectorStore = new ChromaVectorGateway(embeddings, configuration, logger);

    // Create document loader
    const documentLoader = new DocumentLoaderGateway(logger);

    // Create presenter
    const presenter = new PresenterAdapter();

    // Create use cases
    const askQuestionUseCase = new AskQuestionUseCase(
      languageModel,
      vectorStore,
      messageHistory,
      logger
    );

    const ingestDocumentsUseCase = new IngestDocumentsUseCase(
      documentLoader,
      vectorStore,
      logger
    );

    const clearHistoryUseCase = new ClearHistoryUseCase(messageHistory, logger);

    logger.info("RAG services initialized successfully");

    return {
      languageModel,
      vectorStore,
      embeddings,
      messageHistory,
      documentLoader,
      configuration,
      logger,
      presenter,
      askQuestionUseCase,
      ingestDocumentsUseCase,
      clearHistoryUseCase,
    };
  }
}
