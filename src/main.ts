// Load environment variables from .env file
import "dotenv/config";
// Import the LLM (Large Language Model) and prompt template components
import { Ollama } from "@langchain/community/llms/ollama";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import * as readline from "readline/promises";
// Import the retriever we set up in vector.ts to search for relevant reviews
import { getRetriever } from "./vector.js";
// Import validation functions for security
import { sanitizeQuestion, validateQuestion } from "./validation.js";
// Import configuration service
import { ConfigService } from "./config.js";

// Get the configuration service (loads and validates all configuration)
const configService = ConfigService.getInstance(import.meta.url);

// Initialize message history for chat context (persists across questions in the session)
const messageHistory = new InMemoryChatMessageHistory();

/**
 * Main function to run the RAG application
 */
async function main() {
  console.log("Initializing RAG system...");

  // Load all configuration (will throw if required env vars are missing)
  const config = configService.getConfig();
  const promptsConfig = config.prompts;

  // Initialize the local Ollama LLM model
  const model = new Ollama(config.ollama);

  // Create a message-based prompt template with chat history support
  // Extract system message from template by removing the {question} reference line
  const systemMessage = promptsConfig.template
    .split('\n')
    .filter(line => !line.includes('{question}'))
    .join('\n')
    .trim();
  
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemMessage],
    new MessagesPlaceholder("chat_history"),
    ["human", "{question}"],
  ]);

  // Create a chain with message history support
  const baseChain = prompt.pipe(model);
  const chain = new RunnableWithMessageHistory({
    runnable: baseChain,
    getMessageHistory: async (_sessionId: string) => messageHistory,
    inputMessagesKey: "question",
    historyMessagesKey: "chat_history",
  });

  // Set up readline interface for interactive input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // Get the retriever (this will set up the vector database if needed)
    const retriever = await getRetriever();

    console.log("RAG system ready!");
    
  // Main interactive loop - keeps asking questions until user quits
    while (true) {
      console.log("---------------------------------------------------");
      // Always append command instructions to the question prompt
      let questionPrompt = promptsConfig.question || "Enter your question about pizza restaurants";
      questionPrompt = questionPrompt.trim();
      if (questionPrompt.endsWith(":")) {
        questionPrompt = questionPrompt.slice(0, -1).trim();
      }
      questionPrompt += " (q=quit, clear=reset history): ";
      const question = await rl.question(questionPrompt);
      console.log("---------------------------------------------------");

      // Check if user wants to quit
      if (question.toLowerCase().trim() === "q") {
        break;
      }

      // Check if user wants to clear chat history
      if (question.toLowerCase().trim() === "clear") {
        await messageHistory.clear();
        console.log("✓ Chat history cleared!");
        continue;
      }

      // Validate question input
      const validation = validateQuestion(question);
      if (!validation.valid) {
        console.error(`Invalid question: ${validation.error}`);
        continue;
      }

      // Sanitize the question to prevent prompt injection
      const sanitizedQuestion = sanitizeQuestion(question);

      try {
        // Step 1: Use the retriever to find the 5 most relevant reviews for this question
        console.log("Querying vector database for:", sanitizedQuestion);
        const reviewDocs = await retriever.invoke(sanitizedQuestion);
        console.log(`Found ${reviewDocs.length} relevant documents`);

        // Format the documents into a readable string
        const reviewsText = reviewDocs
          .map((doc, idx) => `Review ${idx + 1}:\n${doc.pageContent}`)
          .join("\n\n");

        // Step 2: Pass both the reviews and question to the LLM chain
        // The chain fills in the prompt template and sends it to the model
        const results = await chain.invoke(
          {
            reviews: reviewsText, // Context from vector database (formatted as string)
            question: sanitizedQuestion, // User's question (sanitized to prevent injection)
          },
          {
            configurable: { sessionId: "default-session" },
          }
        );

        // Step 3: Print the LLM's answer
        console.log(results);
      } catch (error) {
        console.error("Error processing question:", error);
      }
    }

    console.log("Goodbye!");
  } finally {
    // Ensure readline interface is always closed, even on errors
    rl.close();
  }
}

// Run the main function
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
