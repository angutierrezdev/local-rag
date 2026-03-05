/**
 * CliController - Interface Adapters Layer
 * Handles CLI user interaction for the RAG system
 */

import * as readline from "readline/promises";
import type { IPresenter } from '../../application/ports/presenter.js';
import type { ILogger } from '../../application/ports/logger.js';
import { AskQuestionUseCase } from '../../application/use-cases/ask-question-use-case.js';
import { ClearHistoryUseCase } from '../../application/use-cases/clear-history-use-case.js';
import { AskQuestionRequest } from '../../application/dto/ask-question-request.js';

export class CliController {
  private rl: readline.Interface;

  constructor(
    private askQuestionUseCase: AskQuestionUseCase,
    private clearHistoryUseCase: ClearHistoryUseCase,
    private presenter: IPresenter,
    private logger: ILogger
  ) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async run(): Promise<void> {
    try {
      console.log("RAG system ready!");
      console.log('Type "q" to quit, "clear" to reset history\n');

      while (true) {
        const separator = "-".repeat(80);
        console.log(separator);

        const question = await this.rl.question(
          "Enter your question (q=quit, clear=reset history): "
        );
        console.log(separator);

        // Handle quit command
        if (question.toLowerCase().trim() === "q") {
          console.log("Goodbye!");
          break;
        }

        // Handle clear history command
        if (question.toLowerCase().trim() === "clear") {
          try {
            await this.clearHistoryUseCase.execute();
            console.log("✓ Chat history cleared!\n");
          } catch (error) {
            console.error(
              `Failed to clear history: ${error instanceof Error ? error.message : String(error)}`
            );
          }
          continue;
        }

        // Process question
        try {
          const request = new AskQuestionRequest(question);
          const response = await this.askQuestionUseCase.execute(request);
          console.log(this.presenter.format(response as any));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(this.presenter.formatError(new Error(errorMessage)));
          this.logger.error("Error processing question", error as Error);
        }
      }
    } finally {
      this.rl.close();
    }
  }
}
