// Load environment variables from .env file
import "dotenv/config";
import path from "path";
import { watch } from "chokidar";
import { ConfigService } from "./config.js";
import { getRetriever } from "./vector.js";
import { SUPPORTED_EXTENSIONS } from "./loaders/documentLoader.js";

// Supported file extensions are defined centrally in documentLoader.ts

interface QueueItem {
  filePath: string;
  clientId: string;
}

const queue: QueueItem[] = [];
let processing = false;

/**
 * Process the ingestion queue sequentially (one file at a time).
 * Sequential ingestion prevents concurrent ChromaDB writes and memory spikes.
 */
async function processQueue(): Promise<void> {
  if (processing || queue.length === 0) return;

  processing = true;
  const item = queue.shift()!;

  console.log(
    `[watcher] Processing: ${item.filePath} (clientId: ${item.clientId})`
  );

  try {
    await getRetriever(item.filePath, item.clientId);
    console.log(`[watcher] Ingestion complete: ${path.basename(item.filePath)}`);
  } catch (err) {
    if (err instanceof Error) {
      console.error(`[watcher] Ingestion failed for ${item.filePath}:`);
      console.error(`  message: ${err.message}`);
    } else {
      console.error(`[watcher] Ingestion failed for ${item.filePath}:`, err);
    }
  }

  processing = false;
  // Process the next queued item, if any
  processQueue();
}

/**
 * Start the folder watcher.
 * Watches the configured watch folder for new files two levels deep ({clientId}/{filename}),
 * extracts the clientId from the subfolder name, and triggers RAG ingestion.
 */
async function startWatcher(): Promise<void> {
  const configService = ConfigService.getInstance(import.meta.url);
  const config = configService.getConfig();
  const { watchFolder, watchPolling } = config.watcher;

  console.log(`[watcher] Starting — watching folder: ${watchFolder}`);
  console.log(`[watcher] Polling mode: ${watchPolling}`);

  const watcher = watch(watchFolder, {
    ignored: /(^|[/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true, // don't trigger for files already present on startup
    depth: 2, // {watchFolder}/{clientId}/{filename} — exactly two levels
    usePolling: watchPolling, // required for Docker on macOS
    interval: 1000,
  });

  watcher.on("add", (filePath: string) => {
    const ext = path.extname(filePath).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      console.log(
        `[watcher] Ignoring unsupported file type: ${path.basename(filePath)}`
      );
      return;
    }

    // Extract clientId from the immediate parent folder of the file.
    // Expected structure: {watchFolder}/.../{clientId}/{filename}
    // Using the direct parent makes this robust regardless of how the volume is mounted.
    const clientId = path.basename(path.dirname(filePath));

    if (!clientId || clientId === "." || clientId === watchFolder) {
      console.log(
        `[watcher] Ignoring file with no identifiable clientId folder: ${filePath}`
      );
      return;
    }
    console.log(
      `[watcher] Queued: ${path.basename(filePath)} (clientId: ${clientId})`
    );

    queue.push({ filePath, clientId });
    processQueue();
  });

  watcher.on("error", (error: unknown) => {
    console.error("[watcher] Watcher error:", error instanceof Error ? error.message : error);
  });

  watcher.on("ready", () => {
    console.log("[watcher] Ready — waiting for new files...");
  });
}

// Start the watcher
startWatcher().catch((err) => {
  console.error("[watcher] Fatal startup error:", err);
  process.exit(1);
});
