/**
 * PresenterAdapter - Interface Adapters Layer
 * Implements IPresenter for formatted console output
 */

import type { IPresenter } from "../../application/ports/IPresenter.js";
import type { RagResponse } from "../../domain/entities/RagResponse.js";

export class PresenterAdapter implements IPresenter {
  format(response: RagResponse): string {
    const lines: string[] = [];

    lines.push("\n" + "=".repeat(80));
    lines.push("ANSWER:");
    lines.push("=".repeat(80));
    lines.push(response.getFormattedAnswer());

    if (response.hasSourceDocuments()) {
      lines.push("\n" + "=".repeat(80));
      lines.push("SOURCES:");
      lines.push("=".repeat(80));

      response.sourceDocuments.forEach((doc, index) => {
        lines.push(`\n[${index + 1}] ${doc.metadata?.source || "Unknown"}`);
        lines.push("-".repeat(40));
        lines.push(doc.pageContent.substring(0, 200) + "...");
      });
    }

    lines.push("\n" + "=".repeat(80));
    return lines.join("\n");
  }

  formatError(error: Error): string {
    return `\n❌ ERROR: ${error.message}\n`;
  }

  formatMessage(message: string): string {
    return `\nℹ️  ${message}\n`;
  }

  getFormat(): string {
    return "console";
  }
}
