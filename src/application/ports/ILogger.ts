/**
 * ILogger Port - Application Layer Contract
 * Abstraction for logging implementations
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ILogger {
  /**
   * Logs a debug message
   */
  debug(message: string, context?: Record<string, any>): void;

  /**
   * Logs an info message
   */
  info(message: string, context?: Record<string, any>): void;

  /**
   * Logs a warning message
   */
  warn(message: string, context?: Record<string, any>): void;

  /**
   * Logs an error message
   */
  error(message: string, error?: Error, context?: Record<string, any>): void;

  /**
   * Sets the minimum log level
   */
  setLevel(level: LogLevel): void;

  /**
   * Gets the current log level
   */
  getLevel(): LogLevel;

  /**
   * Creates a child logger with a context
   */
  createChild(context: Record<string, any>): ILogger;
}
