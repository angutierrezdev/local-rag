/**
 * RagServiceFactory - Dependency Injection Container
 * Assembles all dependencies and creates the RAG application components
 */

import type { ILanguageModel } from '../../application/ports/language-model.js';
import type { IVectorStore } from '../../application/ports/vector-store.js';
import type { IEmbeddings } from '../../application/ports/embeddings.js';
import type { IMessageHistory } from '../../application/ports/message-history.js';
import type { IDocumentLoader } from '../../application/ports/document-loader.js';
import type { IConfiguration } from '../../application/ports/configuration.js';
import type { ILogger } from '../../application/ports/logger.js';
import type { IPresenter } from '../../application/ports/presenter.js';

import { OllamaLLMGateway } from '../gateways/ollama-llm-gateway.js';
import { ChromaVectorGateway } from '../gateways/chroma-vector-gateway.js';
import { OllamaEmbeddingsGateway } from '../gateways/ollama-embeddings-gateway.js';
import { InMemoryHistoryGateway } from '../gateways/in-memory-history-gateway.js';
import { DocumentLoaderGateway } from '../gateways/document-loader-gateway.js';
import { ConfigurationAdapter } from '../gateways/configuration-adapter.js';
import { ConsoleLoggerAdapter } from '../gateways/console-logger-adapter.js';
import { PresenterAdapter } from '../gateways/presenter-adapter.js';

import { AskQuestionUseCase } from '../../application/use-cases/ask-question-use-case.js';
import { IngestDocumentsUseCase } from '../../application/use-cases/ingest-documents-use-case.js';
import { ClearHistoryUseCase } from '../../application/use-cases/clear-history-use-case.js';

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

