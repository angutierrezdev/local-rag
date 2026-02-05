# Import the LLM (Large Language Model) and prompt template components
from langchain_ollama.llms import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate
# Import the retriever we set up in vector.py to search for relevant reviews
from vector import retriever

# Initialize the local Ollama LLM model (llama3.2)
model = OllamaLLM(model="llama3.2")

# Define the prompt template that will be sent to the LLM
# {reviews} and {question} are placeholders that will be filled with actual data
template = """
You are an expert in answering questions about pizza restaurants.

Here are some relevant reviews about pizza restaurants: {reviews}

Here is a question about pizza restaurants: {question}

Try to be helpful but concise in your answer.
"""

# Create a prompt template object from the string
prompt = ChatPromptTemplate.from_template(template)

# Create a chain that pipes the prompt into the model
# The | operator chains these components together
chain = prompt | model

# Main interactive loop - keeps asking questions until user quits
while True:    
    print("---------------------------------------------------")
    question = input("Enter your question about pizza restaurants (or q to quit): ")
    print("---------------------------------------------------")
    
    # Check if user wants to quit
    if question.lower() == 'q':
        break

    # Step 1: Use the retriever to find the 5 most relevant reviews for this question
    reviews = retriever.invoke(question)
    
    # Step 2: Pass both the reviews and question to the LLM chain
    # The chain fills in the prompt template and sends it to the model
    results = chain.invoke({
        "reviews": reviews,  # Context from vector database
        "question": question  # User's question
    })

    # Step 3: Print the LLM's answer
    print(results)