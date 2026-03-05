/**
 * Watcher Entry Point - Ultra-Clean
 * Delegates all file watching orchestration to DI container and controller
 */

import "dotenv/config";
import { RagServiceFactory } from './adapters/factories/rag-service-factory.js';
import { WatcherController } from './adapters/controllers/watcher-controller.js';

/**
 * Bootstrap the file watcher with dependency injection
 */
async function main(): Promise<void> {
  try {
    console.log("Initializing file watcher...\n");

    // Create all services via DI factory
    const services = RagServiceFactory.createServices(import.meta.url);

    // Create and run watcher controller
    const controller = new WatcherController(
      services.ingestDocumentsUseCase,
      services.configuration,
      services.logger
    );

    await controller.start();

    // Keep process alive
    console.log("Watcher is running. Press Ctrl+C to stop.");
    await new Promise(() => {}); // Never resolves, process keeps running
  } catch (error) {
    console.error(
      "Fatal error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();
