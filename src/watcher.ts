// Load environment variables from .env file
import "dotenv/config";
import path from "path";
import { readdirSync, statSync } from "fs";
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
const queuedFiles = new Set<string>(); // Track files already in queue to prevent duplicates
let processing = false;

/**
 * Process one item from the ingestion queue (if not already processing).
 * Called on a fixed interval — no recursion, no manual re-triggering.
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

  // Remove from tracked set after processing so the file can be re-queued later if needed
  queuedFiles.delete(item.filePath);
  processing = false;
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

    // Check if file is already queued to prevent duplicate processing
    if (queuedFiles.has(filePath)) {
      console.log(
        `[watcher] File already queued, ignoring duplicate: ${path.basename(filePath)}`
      );
      return;
    }

    console.log(
      `[watcher] Queued: ${path.basename(filePath)} (clientId: ${clientId})`
    );

    queue.push({ filePath, clientId });
    queuedFiles.add(filePath);
  });

  watcher.on("error", (error: unknown) => {
    console.error("[watcher] Watcher error:", error instanceof Error ? error.message : error);
  });

  // Scan existing files only once chokidar has finished its initial baseline scan.
  // Doing this in "ready" eliminates the race condition where a file added between
  // the startup readdirSync and chokidar's first poll would be missed by both.
  watcher.on("ready", () => {
    console.log("[watcher] Ready — scanning existing files...");
    try {
      const clientDirs = readdirSync(watchFolder);
      for (const clientId of clientDirs) {
        const clientPath = path.join(watchFolder, clientId);
        if (!statSync(clientPath).isDirectory()) {
          if (statSync(clientPath).isFile()) {
            console.warn(
              `[watcher] Ignoring file placed directly in watch folder (no clientId subfolder): ${clientId}`
            );
          }
          continue;
        }

        const files = readdirSync(clientPath);
        for (const file of files) {
          const filePath = path.join(clientPath, file);
          if (!statSync(filePath).isFile()) continue;
          const ext = path.extname(filePath).toLowerCase();
          if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

          // Check if file is already queued to prevent duplicate processing
          if (queuedFiles.has(filePath)) {
            console.log(`[watcher] Skipping already-queued file: ${file}`);
            continue;
          }

          console.log(`[watcher] Queuing existing file: ${file} (clientId: ${clientId})`);
          queue.push({ filePath, clientId });
          queuedFiles.add(filePath);
        }
      }
    } catch (err) {
      console.warn("[watcher] Could not scan existing files:", err instanceof Error ? err.message : err);
    }
    console.log("[watcher] Waiting for new files...");

    // Kick off processing immediately for files found during the initial scan
    // rather than waiting up to 30 s for the first interval tick.
    processQueue().catch((err) => {
      console.error("[watcher] Unexpected error in processQueue:", err instanceof Error ? err.message : err);
    });
  });
}

// Start the watcher.
startWatcher().catch((err) => {
  console.error("[watcher] Fatal startup error:", err);
  process.exit(1);
});

// Poll the queue every 30 seconds for files added after the initial scan.
// The "ready" handler triggers an immediate first run so startup files
// are not delayed by up to 30 s waiting for the first tick.
setInterval(() => {
  processQueue().catch((err) => {
    console.error("[watcher] Unexpected error in processQueue:", err instanceof Error ? err.message : err);
  });
}, 5000);
