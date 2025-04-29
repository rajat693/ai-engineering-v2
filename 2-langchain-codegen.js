// LangChain is a framework for developing applications powered by large language models (LLMs).
const dotenv = require("dotenv");
const { ChatOpenAI } = require("@langchain/openai");
const { SystemMessage, HumanMessage } = require("@langchain/core/messages");

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Error: OPENAI_API_KEY environment variable is not set.");
  process.exit(1);
}

// Get user query from command line arguments
const args = process.argv.slice(2);
const query = args.join(" ");

if (!query) {
  console.error("Error: No query provided.");
  process.exit(1);
}

console.log("Generating code based on your request...");

async function generateCode(prompt) {
  try {
    // Initialize the ChatOpenAI model
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      apiKey: apiKey,
      temperature: 0.7,
    });

    // Create messages
    const messages = [
      new SystemMessage(
        "You are a full-stack development expert skilled in both backend (Node.js) and frontend (web and native) development. You are knowledgeable about all major component libraries, programming fundamentals, and relevant languages. When asked to generate code, provide complete, functional code without explanations unless specifically requested. Focus on production-quality code that follows best practices. For UI components, prioritize simplicity and clean design over complexity."
      ),
      new HumanMessage(`Generate code for the following request: ${prompt}`),
    ];

    // Call the LLM with the messages
    const response = await model.invoke(messages);

    // Return the content of the response
    return response.content;
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Execute the function and display the result
(async () => {
  try {
    const result = await generateCode(query);
    console.log("\n--- GENERATED CODE ---\n");
    console.log(result);
    console.log("\n--- END OF GENERATED CODE ---");
  } catch (err) {
    console.error("An unexpected error occurred:", err);
  }
})();

//node 2-langchain-codegen.js "create a simple login form in react"
