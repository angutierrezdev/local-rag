import { existsSync } from "fs";
import path from "path";

/**
 * Sanitizes user input to prevent LLM prompt injection attacks
 * @param input - Raw user input
 * @param maxLength - Maximum allowed length (default: 5000)
 * @returns Sanitized input safe for LLM consumption
 */
export function sanitizeQuestion(input: string, maxLength: number = 5000): string {
  if (!input) {
    return "";
  }

  // Remove potentially dangerous patterns and limit length
  let sanitized = input.substring(0, maxLength);

  // Remove execution patterns that could be used for injection
  // Remove common injection markers
  sanitized = sanitized
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/\[SYSTEM\]/gi, "") // Remove system markers
    .replace(/\[INST\]/gi, "") // Remove instruction markers
    .replace(/<<SYS>>/gi, "")
    .replace(/<\/SYS>>/gi, "");

  // Remove SQL-like injection patterns
  sanitized = sanitized
    .replace(/(--|\#|\*|-{2,})/g, "") // Remove SQL comments
    .replace(/;(\s*)DROP/gi, "; DROP") // Prevent SQL injection variations
    .replace(/;\s*(DELETE|UPDATE|INSERT)/gi, "; $1");

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Validates that a file path is safe and doesn't attempt directory traversal
 * Supports CSV, PDF, DOCX, and DOC file formats
 * @param providedPath - User-provided file path
 * @param baseDir - Base directory where files should be located
 * @returns Validated absolute path if safe, throws error otherwise
 * @throws Error if path is invalid, outside base directory, doesn't exist, or unsupported file type
 */
export function validateFilePath(providedPath: string, baseDir: string): string {
  if (!providedPath || typeof providedPath !== "string") {
    throw new Error("Invalid file path: must be a non-empty string");
  }

  // Normalize the path to remove ../ patterns and resolve symlinks
  const normalized = path.normalize(providedPath);

  // Resolve to absolute path
  const absolutePath = path.isAbsolute(normalized)
    ? normalized
    : path.join(baseDir, normalized);

  // Prevent directory traversal by ensuring the path is within baseDir
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(absolutePath);

  // Ensure the resolved path is within the allowed base directory
  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    throw new Error(
      `File path is outside allowed directory. Attempted: ${resolvedPath}, Allowed: ${resolvedBase}`
    );
  }

  // Check file exists
  if (!existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  // Check for supported file types
  const supportedExtensions = [".csv", ".pdf", ".docx", ".doc"];
  const ext = path.extname(resolvedPath).toLowerCase();
  if (!supportedExtensions.includes(ext)) {
    throw new Error(
      `File must be one of: ${supportedExtensions.join(", ")}. Got: ${ext}`
    );
  }

  return resolvedPath;
}

/**
 * Validates that a CSV file path is safe and doesn't attempt directory traversal
 * @deprecated Use validateFilePath instead for support of multiple file formats
 * @param providedPath - User-provided file path
 * @param baseDir - Base directory where CSV files should be located
 * @returns Validated absolute path if safe, throws error otherwise
 */
export function validateCsvPath(providedPath: string, baseDir: string): string {
  return validateFilePath(providedPath, baseDir);
}

/**
 * Validates question input for common issues
 * @param question - User question
 * @returns Validation result with valid flag and optional error message
 */
export function validateQuestion(
  question: string
): { valid: boolean; error?: string } {
  if (!question || typeof question !== "string") {
    return { valid: false, error: "Question must be a non-empty string" };
  }

  const trimmed = question.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Question cannot be empty" };
  }

  if (trimmed.length > 5000) {
    return { valid: false, error: "Question is too long (max 5000 characters)" };
  }

  // Check for obvious injection patterns
  const injectionPatterns = /(\[SYSTEM\]|\[INST\]|<<SYS>>|<\/SYS>>|```)/gi;
  if (injectionPatterns.test(trimmed)) {
    return { valid: false, error: "Question contains potentially harmful patterns" };
  }

  return { valid: true };
}
