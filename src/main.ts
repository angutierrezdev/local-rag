/**
 * Main Entry Point - Ultra-Clean
 * Delegates all orchestration to DI container and controller
 */

import "dotenv/config";
import { RagServiceFactory } from './adapters/factories/rag-service-factory.js';
import { CliController } from './adapters/controllers/cli-controller.js';

/**
 * Bootstrap the application with dependency injection
 */
async function main(): Promise<void> {
  try {
    console.log("Initializing RAG system...\n");

    // Create all services via DI factory
    const services = RagServiceFactory.createServices(import.meta.url);

    // Create and run CLI controller
    const controller = new CliController(
      services.askQuestionUseCase,
      services.clearHistoryUseCase,
      services.presenter,
      services.logger
    );

    await controller.run();
  } catch (error) {
    console.error(
      "Fatal error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();
