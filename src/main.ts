// Load environment variables from .env file
import "dotenv/config";
// Import the LLM (Large Language Model) and prompt template components
import { Ollama } from "@langchain/ollama";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import * as readline from "readline/promises";
// Import the retriever we set up in vector.ts to search for relevant reviews
import {
  getRetriever,
  listCollections,
  getRetrieverByCollectionName,
  extractClientId,
  getCollectionsByClientId,
} from "./vector.js";
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
  // The system message contains {reviews} which is filled at query time with retrieved documents
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", promptsConfig.template],
    new MessagesPlaceholder("chat_history"),
    ["human", "{question}"],
  ]);

  // Create a chain with message history support
  const baseChain = prompt.pipe(model);
  const chain = new RunnableWithMessageHistory({
    runnable: baseChain,
    getMessageHistory: (_sessionId: string) => messageHistory,
    inputMessagesKey: "question",
    historyMessagesKey: "chat_history",
  });

  // Set up readline interface for interactive input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // List available collections and let the user choose one
    type Retriever = Awaited<ReturnType<typeof getRetrieverByCollectionName>>;
    let retrievers: Retriever[];
    const collections = await listCollections();

    if (collections.length === 0) {
      console.log("No collections found in ChromaDB. Running default setup...");
      const defaultRetriever = await getRetriever();
      retrievers = [defaultRetriever as unknown as Retriever];
    } else {
      console.log("\nAvailable collections:");
      collections.forEach((name, idx) => {
        console.log(`  [${idx + 1}] ${name}`);
      });
      console.log();

      let chosenCollection: string | undefined;
      while (!chosenCollection) {
        const answer = await rl.question(
          `Select a collection (1-${collections.length}): `
        );
        const num = parseInt(answer.trim(), 10);
        if (num >= 1 && num <= collections.length) {
          chosenCollection = collections[num - 1];
        } else {
          console.log(`Please enter a number between 1 and ${collections.length}.`);
        }
      }

      const clientId = extractClientId(chosenCollection);
      const targetCollections =
        clientId !== null
          ? getCollectionsByClientId(clientId, collections)
          : [chosenCollection];

      if (targetCollections.length > 1) {
        console.log(`\nFound ${targetCollections.length} collections for clientId "${clientId}":`);
        targetCollections.forEach((name) => console.log(`  - ${name}`));
      } else {
        console.log(`\nUsing collection: ${chosenCollection}`);
      }

      retrievers = await Promise.all(
        targetCollections.map((name) => getRetrieverByCollectionName(name))
      );
    }

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
        // Step 1: Use all retrievers to find relevant documents across collections
        console.log("Querying vector database for:", sanitizedQuestion);
        const rawResults = await Promise.all(
          retrievers.map((r) => r.invoke(sanitizedQuestion))
        );
        // Flatten and deduplicate by pageContent
        const seen = new Set<string>();
        const reviewDocs = rawResults.flat().filter((doc) => {
          if (seen.has(doc.pageContent)) return false;
          seen.add(doc.pageContent);
          return true;
        });
        console.log(
          `Found ${reviewDocs.length} relevant documents across ${retrievers.length} collection(s)`
        );

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
