/**
 * MultiTenancyPolicy Domain Service
 * Enforces multi-tenancy rules for collection isolation
 */

export class MultiTenancyPolicy {
  private collectionNameSeparator = "__";

  /**
   * Generates an isolated collection name for a client
   * Format: clientId__collectionName
   */
  generateCollectionName(clientId: string, collectionName: string): string {
    this.validateClientId(clientId);
    this.validateCollectionName(collectionName);

    return `${clientId}${this.collectionNameSeparator}${collectionName}`;
  }

  /**
   * Extracts client ID from a collection name
   * Returns null if the name doesn't follow the expected format
   */
  extractClientId(collectionName: string): string | null {
    const parts = collectionName.split(this.collectionNameSeparator);
    return parts.length >= 2 ? parts[0] : null;
  }

  /**
   * Verifies that a collection belongs to a specific client
   */
  belongsToClient(collectionName: string, clientId: string): boolean {
    const extractedId = this.extractClientId(collectionName);
    return extractedId === clientId;
  }

  /**
   * Enforces isolation: prevents a client from accessing other clients' collections
   */
  isAccessAllowed(
    collectionName: string,
    requestingClientId: string
  ): boolean {
    return this.belongsToClient(collectionName, requestingClientId);
  }

  private validateClientId(clientId: string): void {
    if (!clientId || clientId.trim().length === 0) {
      throw new Error("Client ID cannot be empty");
    }

    if (clientId.includes(this.collectionNameSeparator)) {
      throw new Error(
        `Client ID cannot contain separator '${this.collectionNameSeparator}'`
      );
    }
  }

  private validateCollectionName(collectionName: string): void {
    if (!collectionName || collectionName.trim().length === 0) {
      throw new Error("Collection name cannot be empty");
    }

    if (collectionName.includes(this.collectionNameSeparator)) {
      throw new Error(
        `Collection name cannot contain separator '${this.collectionNameSeparator}'`
      );
    }
  }
}
