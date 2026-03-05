/**
 * DocumentCollection Entity - Domain Core
 * Represents a grouped collection of documents for a client
 */

import type { Document } from "@langchain/core/documents";

export interface IDocumentCollection {
  readonly name: string;
  readonly clientId: string;
  readonly documents: Document[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class DocumentCollection implements IDocumentCollection {
  readonly name: string;
  readonly clientId: string;
  readonly documents: Document[];
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(
    name: string,
    clientId: string,
    documents: Document[] = [],
    createdAt?: Date,
    updatedAt?: Date
  ) {
    this.validateName(name);
    this.validateClientId(clientId);

    this.name = name;
    this.clientId = clientId;
    this.documents = documents;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error("Collection name cannot be empty");
    }

    // Collection names should only contain alphanumeric chars, hyphens, underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error(
        "Collection name can only contain alphanumeric characters, hyphens, and underscores"
      );
    }
  }

  private validateClientId(clientId: string): void {
    if (!clientId || clientId.trim().length === 0) {
      throw new Error("Client ID cannot be empty");
    }
  }

  addDocuments(docs: Document[]): void {
    this.documents.push(...docs);
    (this.updatedAt as any) = new Date();
  }

  getDocumentCount(): number {
    return this.documents.length;
  }

  isEmpty(): boolean {
    return this.documents.length === 0;
  }
}
