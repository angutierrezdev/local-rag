import path from "path";
import { fileURLToPath } from "url";

/**
 * Get the directory name from import.meta.url in ESM modules
 * This is needed because __dirname is not available in ESM
 *
 * @param importMetaUrl - The import.meta.url from the module
 * @returns The directory path of the module
 *
 * @example
 * ```typescript
 * import { getDirname } from "./utils/esm.js";
 * const __dirname = getDirname(import.meta.url);
 * ```
 */
export function getDirname(importMetaUrl: string): string {
  const __filename = fileURLToPath(importMetaUrl);
  return path.dirname(__filename);
}

/**
 * Get the file path from import.meta.url in ESM modules
 *
 * @param importMetaUrl - The import.meta.url from the module
 * @returns The file path of the module
 *
 * @example
 * ```typescript
 * import { getFilename } from "./utils/esm.js";
 * const __filename = getFilename(import.meta.url);
 * ```
 */
export function getFilename(importMetaUrl: string): string {
  return fileURLToPath(importMetaUrl);
}
