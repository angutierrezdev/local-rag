/**
 * ILanguageModel Port - Application Layer Contract
 * Abstraction for language model implementations (Ollama, GPT, etc)
 */

export interface ILanguageModel {
  /**
   * Invokes the language model with a prompt and optional context
   * @param prompt - The prompt text to send to the model
   * @param context - Optional context or conversation history
   * @returns The model's response as a string
   */
  invoke(prompt: string, context?: Record<string, any>): Promise<string>;

  /**
   * Invokes the model with a structured input (typically for chat)
   * @param input - Key-value pairs for template variables
   * @returns The model's response as a string
   */
  invokeWithInput(input: Record<string, string>): Promise<string>;

  /**
   * Checks if the model supports streaming responses
   */
  supportsStreaming(): boolean;

  /**
   * Streams a response from the model (if supported)
   * @param prompt - The prompt text
   * @param onChunk - Callback for each chunk of the response
   */
  streamInvoke(
    prompt: string,
    onChunk: (chunk: string) => void
  ): Promise<string>;

  /**
   * Gets model information/metadata
   */
  getModelInfo(): Record<string, any>;
}
