/**
 * IMessageHistory Port - Application Layer Contract
 * Abstraction for message history storage implementations
 */

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
}

export interface IMessageHistory {
  /**
   * Adds a message to the history
   * @param role - Role of the message sender
   * @param content - Content of the message
   */
  addMessage(role: "user" | "assistant" | "system", content: string): Promise<void>;

  /**
   * Gets all messages in the history
   */
  getMessages(): Promise<Message[]>;

  /**
   * Gets the last N messages
   */
  getRecentMessages(count: number): Promise<Message[]>;

  /**
   * Clears all messages from the history
   */
  clear(): Promise<void>;

  /**
   * Gets the message count
   */
  getMessageCount(): Promise<number>;

  /**
   * Gets the session ID if applicable
   */
  getSessionId(): string | undefined;

  /**
   * Exports history in a specific format
   */
  export(): Promise<string>;
}
