import path from "path";
import { getDirname } from "./esm.js";

// Cache the project root directory (resolved once at module load)
let projectRoot: string | null = null;

/**
 * Get the project root directory
 * The root is determined by going up one level from the src directory
 *
 * @param importMetaUrl - The import.meta.url from the calling module (only used on first call)
 * @returns The absolute path to the project root
 */
export function getProjectRoot(importMetaUrl?: string): string {
  // Return cached value if already computed
  if (projectRoot) {
    return projectRoot;
  }

  // If not cached, compute it
  // If no importMetaUrl provided, throw error (should only happen on first call)
  if (!importMetaUrl) {
    throw new Error(
      "Project root not initialized. Call getProjectRoot with import.meta.url on first use."
    );
  }

  // Get src directory and go up one level to project root
  const srcDir = getDirname(importMetaUrl);
  projectRoot = path.dirname(srcDir);

  return projectRoot;
}

/**
 * Resolve a path relative to the project root
 *
 * @param relativePath - Path relative to project root (e.g., "data/reviews.csv")
 * @param importMetaUrl - The import.meta.url from the calling module
 * @returns The absolute path
 *
 * @example
 * ```typescript
 * import { resolveFromRoot } from "./utils/paths.js";
 * const csvPath = resolveFromRoot("data/reviews.csv", import.meta.url);
 * ```
 */
export function resolveFromRoot(
  relativePath: string,
  importMetaUrl: string
): string {
  const root = getProjectRoot(importMetaUrl);
  return path.join(root, relativePath);
}

/**
 * Resolve a path relative to the src directory
 *
 * @param relativePath - Path relative to src directory (e.g., "../data/reviews.csv")
 * @param importMetaUrl - The import.meta.url from the calling module
 * @returns The absolute path
 *
 * @example
 * ```typescript
 * import { resolveFromSrc } from "./utils/paths.js";
 * const configPath = resolveFromSrc("../prompts/default.json", import.meta.url);
 * ```
 */
export function resolveFromSrc(
  relativePath: string,
  importMetaUrl: string
): string {
  const srcDir = getDirname(importMetaUrl);
  return path.resolve(path.join(srcDir, relativePath));
}
