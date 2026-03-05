/**
 * ConsoleLoggerAdapter - Interface Adapters Layer
 * Implements ILogger using console output
 */

import type { ILogger, LogLevel } from "../../application/ports/ILogger.js";

export class ConsoleLoggerAdapter implements ILogger {
  private level: LogLevel = "info";
  private context: Record<string, any> = {};

  constructor(context?: Record<string, any>, level?: LogLevel) {
    this.context = context || {};
    if (level) {
      this.level = level;
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    if (this.shouldLog("debug")) {
      console.debug(
        `[DEBUG] ${message}`,
        { ...this.context, ...context }
      );
    }
  }

  info(message: string, context?: Record<string, any>): void {
    if (this.shouldLog("info")) {
      console.info(
        `[INFO] ${message}`,
        { ...this.context, ...context }
      );
    }
  }

  warn(message: string, context?: Record<string, any>): void {
    if (this.shouldLog("warn")) {
      console.warn(
        `[WARN] ${message}`,
        { ...this.context, ...context }
      );
    }
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, any>
  ): void {
    if (this.shouldLog("error")) {
      console.error(
        `[ERROR] ${message}`,
        error ? error.message : "",
        { ...this.context, ...context }
      );
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  createChild(context: Record<string, any>): ILogger {
    return new ConsoleLoggerAdapter(
      { ...this.context, ...context },
      this.level
    );
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const currentIndex = levels.indexOf(this.level);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }
}
