// Import the LLM (Large Language Model) and prompt template components
import { Ollama } from "@langchain/community/llms/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import * as readline from "readline/promises";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
// Import the retriever we set up in vector.ts to search for relevant reviews
import { getRetriever } from "./vector";

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables - exit if required vars are missing
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL;
const PROMPTS_CONFIG_PATH = process.env.PROMPTS_CONFIG_PATH || "prompts/default.json";

if (!OLLAMA_BASE_URL) {
  console.error("Error: OLLAMA_BASE_URL environment variable is required");
  process.exit(1);
}

if (!OLLAMA_MODEL) {
  console.error("Error: OLLAMA_MODEL environment variable is required");
  process.exit(1);
}

// Load prompts configuration from external JSON file
const promptsConfigPath = path.join(__dirname, "..", PROMPTS_CONFIG_PATH);
const promptsConfig = JSON.parse(readFileSync(promptsConfigPath, "utf-8"));

// Initialize the local Ollama LLM model
const model = new Ollama({
  model: OLLAMA_MODEL,
  baseUrl: OLLAMA_BASE_URL,
});

// Define the prompt template from the external config file
// {reviews} and {question} are placeholders that will be filled with actual data
const template = promptsConfig.template;

// Create a prompt template object from the string
const prompt = ChatPromptTemplate.fromTemplate(template);

// Create a chain that pipes the prompt into the model
const chain = prompt.pipe(model);

// Set up readline interface for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Main function to run the RAG application
 */
async function main() {
  console.log("Initializing RAG system...");
  
  // Get the retriever (this will set up the vector database if needed)
  const retriever = await getRetriever();
  
  console.log("RAG system ready!");
  
  // Main interactive loop - keeps asking questions until user quits
  while (true) {
    console.log("---------------------------------------------------");
    // Always append "(or q to quit): " to the question prompt
    let questionPrompt = promptsConfig.question || "Enter your question about pizza restaurants";
    questionPrompt = questionPrompt.trim();
    if (questionPrompt.endsWith(":")) {
      questionPrompt = questionPrompt.slice(0, -1).trim();
    }
    questionPrompt += " (or q to quit): ";
    const question = await rl.question(questionPrompt);
    console.log("---------------------------------------------------");

    // Check if user wants to quit
    if (question.toLowerCase().trim() === "q") {
      break;
    }

    // Skip empty questions
    if (!question.trim()) {
      continue;
    }

    try {
      // Step 1: Use the retriever to find the 5 most relevant reviews for this question
      console.log("Querying vector database for:", question);
      const reviewDocs = await retriever.invoke(question);
      console.log(`Found ${reviewDocs.length} relevant documents`);

      // Format the documents into a readable string
      const reviewsText = reviewDocs
        .map((doc, idx) => `Review ${idx + 1}:\n${doc.pageContent}`)
        .join("\n\n");

      // Step 2: Pass both the reviews and question to the LLM chain
      // The chain fills in the prompt template and sends it to the model
      const results = await chain.invoke({
        reviews: reviewsText, // Context from vector database (formatted as string)
        question: question, // User's question
      });

      // Step 3: Print the LLM's answer
      console.log(results);
    } catch (error) {
      console.error("Error processing question:", error);
    }
  }

  // Close the readline interface
  rl.close();
  console.log("Goodbye!");
}

// Run the main function
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
