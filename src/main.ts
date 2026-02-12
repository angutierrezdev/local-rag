// Import the LLM (Large Language Model) and prompt template components
import { Ollama } from "@langchain/community/llms/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import * as readline from "readline/promises";
// Import the retriever we set up in vector.ts to search for relevant reviews
import { getRetriever } from "./vector.js";

// Initialize the local Ollama LLM model (llama3.2)
const model = new Ollama({
  model: "llama3.2",
  baseUrl: "http://localhost:11434", // Default Ollama URL
});

// Define the prompt template that will be sent to the LLM
// {reviews} and {question} are placeholders that will be filled with actual data
const template = `
You are an expert in answering questions about pizza restaurants.

Here are some relevant reviews about pizza restaurants: {reviews}

Here is a question about pizza restaurants: {question}

Try to be helpful but concise in your answer.
`;

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
    const question = await rl.question(
      "Enter your question about pizza restaurants (or q to quit): "
    );
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
