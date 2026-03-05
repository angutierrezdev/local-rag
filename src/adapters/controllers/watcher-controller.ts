/**
 * WatcherController - Interface Adapters Layer
 * Handles automatic document ingestion via file watching
 */

import path from "path";
import { readdirSync, statSync } from "fs";
import { watch } from "chokidar";
import type { ILogger } from '../../application/ports/logger.js';
import type { IConfiguration } from '../../application/ports/configuration.js';
import { IngestDocumentsUseCase } from '../../application/use-cases/ingest-documents-use-case.js';
import { IngestRequest } from '../../application/dto/ingest-request.js';
import { SUPPORTED_EXTENSIONS } from '../../loaders/document-loader.js';

interface QueueItem {
  filePath: string;
  clientId: string;
}

export class WatcherController {
  private queue: QueueItem[] = [];
  private queuedFiles = new Set<string>();
  private processing = false;

  constructor(
    private ingestDocumentsUseCase: IngestDocumentsUseCase,
    private configuration: IConfiguration,
    private logger: ILogger
  ) {}

  async start(): Promise<void> {
    const config = this.configuration.getAll();
    const watchFolder = (config.watcher as any)?.watchFolder || "/watched";
    const watchPolling = (config.watcher as any)?.watchPolling || false;

    this.logger.info("Starting file watcher", {
      watchFolder,
      watchPolling,
    });

    const watcher = watch(watchFolder, {
      ignored: /(^|[/\\])\../,
      persistent: true,
      ignoreInitial: true,
      depth: 2,
      usePolling: watchPolling,
      interval: 1000,
    });

    // Poll queue every 5s for files added after startup scan
    setInterval(() => this.processQueue(), 5000);

    // Scan existing files once chokidar has finished its initial baseline.
    // This avoids the race where a file added between a pre-start readdirSync
    // and chokidar's first poll would be missed by both handlers.
    watcher.on("ready", () => {
      this.logger.info("File watcher ready — scanning existing files");
      try {
        const clientDirs = readdirSync(watchFolder);
        for (const clientId of clientDirs) {
          const clientPath = path.join(watchFolder, clientId);
          if (!statSync(clientPath).isDirectory()) {
            if (statSync(clientPath).isFile()) {
              this.logger.warn("Ignoring file placed directly in watch folder (no clientId subfolder)", { clientId });
            }
            continue;
          }

          const files = readdirSync(clientPath);
          for (const file of files) {
            const filePath = path.join(clientPath, file);
            if (!statSync(filePath).isFile()) continue;
            const ext = path.extname(filePath).toLowerCase();
            if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
            if (this.queuedFiles.has(filePath)) continue;

            this.queue.push({ filePath, clientId });
            this.queuedFiles.add(filePath);
            this.logger.info("Queuing existing file", { file, clientId });
          }
        }
      } catch (err) {
        this.logger.warn("Could not scan existing files", { error: err instanceof Error ? err.message : err });
      }

      // Kick off processing immediately instead of waiting for the first interval tick
      this.processQueue().catch((err) => {
        this.logger.error("Unexpected error in processQueue", err as Error);
      });
    });

    // Handle file additions
    watcher.on("add", (filePath: string) => {
      const ext = path.extname(filePath).toLowerCase();

      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        this.logger.debug("Ignoring unsupported file type", {
          filePath: path.basename(filePath),
        });
        return;
      }

      // Extract client ID from folder structure: watchFolder/{clientId}/filename
      const relativePath = path.relative(watchFolder, filePath);
      const parts = relativePath.split(path.sep);
      const clientId = parts.length >= 2 ? parts[0] : "default";

      // Prevent duplicate queue entries
      if (this.queuedFiles.has(filePath)) {
        this.logger.debug("File already queued", { filePath });
        return;
      }

      this.queue.push({ filePath, clientId });
      this.queuedFiles.add(filePath);

      this.logger.info("File added to ingestion queue", {
        filePath: path.basename(filePath),
        clientId,
        queueSize: this.queue.length,
      });
    });

    this.logger.info("File watcher started successfully");
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const item = this.queue.shift()!;

    this.logger.info("Processing ingestion queue item", {
      filePath: path.basename(item.filePath),
      clientId: item.clientId,
    });

    try {
      const request = new IngestRequest(
        item.filePath,
        item.clientId,
        `documents_${Date.now()}`
      );
      await this.ingestDocumentsUseCase.execute(request);

      this.logger.info("File ingestion completed", {
        filePath: path.basename(item.filePath),
      });
    } catch (error) {
      this.logger.error(
        "File ingestion failed",
        error as Error,
        {
          filePath: item.filePath,
          clientId: item.clientId,
        }
      );
    } finally {
      this.queuedFiles.delete(item.filePath);
      this.processing = false;
    }
  }
}
