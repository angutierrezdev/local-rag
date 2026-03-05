/**
 * AskQuestionUseCase - Application Layer
 * Use case for asking questions and getting RAG responses
 */

import type { ILanguageModel } from "../ports/ILanguageModel.js";
import type { IVectorStore } from "../ports/IVectorStore.js";
import type { IMessageHistory } from "../ports/IMessageHistory.js";
import type { ILogger } from "../ports/ILogger.js";
import { AskQuestionRequest } from "../dto/AskQuestionRequest.js";
import { AskQuestionResponse } from "../dto/AskQuestionResponse.js";
import { Question } from "../../domain/entities/Question.js";
import { RagResponse } from "../../domain/entities/RagResponse.js";

export class AskQuestionUseCase {
  constructor(
    private languageModel: ILanguageModel,
    private vectorStore: IVectorStore,
    private messageHistory: IMessageHistory,
    private logger: ILogger
  ) {}

  async execute(request: AskQuestionRequest): Promise<AskQuestionResponse> {
    const startTime = Date.now();

    try {
      // Validate request
      const validation = request.validate();
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      // Create domain entity
      const question = new Question(request.question, request.clientId);

      this.logger.debug("Processing question", {
        questionLength: question.getLength(),
        clientId: request.clientId,
      });

      // Search for relevant documents
      const retrievalStartTime = Date.now();
      const documents = await this.vectorStore.search(question.text, {
        limit: 5,
      });
      const retrievalTime = Date.now() - retrievalStartTime;

      this.logger.debug(`Retrieved ${documents.length} documents in ${retrievalTime}ms`);

      // Build context for language model
      const context = this.buildContext(question.text, documents);

      // Add user question to history
      await this.messageHistory.addMessage("user", question.text);

      // Get response from language model
      const answer = await this.languageModel.invoke(context);

      // Add assistant response to history
      await this.messageHistory.addMessage("assistant", answer);

      // Create domain response
      const ragResponse = new RagResponse(answer, documents);

      const responseTime = Date.now() - startTime;

      this.logger.info("Question processed successfully", {
        responseTime,
        sourceDocuments: documents.length,
      });

      return new AskQuestionResponse(
        answer,
        documents,
        responseTime,
        undefined,
        request.sessionId
      );
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error("Failed to process question", error as Error, {
        clientId: request.clientId,
        responseTime,
      });
      throw error;
    }
  }

  private buildContext(question: string, documents: any[]): string {
    const documentContext = documents
      .map((doc) => doc.pageContent)
      .join("\n---\n");

    return `You are a helpful assistant. Use the following documents to answer the question.

Documents:
${documentContext}

Question: ${question}

Answer:`;
  }
}
