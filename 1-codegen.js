const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config(); //loads environment variables from the .env file
// require("dotenv").config();  //shortcut for the above

// Check if OpenAI API key is available
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Error: OPENAI_API_KEY environment variable is not set.");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: apiKey,
});

// `process` is a global object in Node.js

// Get user query from command line arguments
const args = process.argv.slice(2); // It starts at index 2 and goes to the end of the array.
const query = args.join(" ");

if (!query) {
  console.error("Error: No query provided.");
  process.exit(1);
}

console.log("Generating code based on your request...");

async function generateCode(prompt) {
  try {
    const response = await openai.responses.create({ // this is the API call to the OpenAI API
      model: "gpt-4o-mini", // this is the model we are using
      input: [
        {
          role: "developer", // tells the AI how it should behave
          content: // this is the system prompt
            "You are a full-stack development expert skilled in both backend (Node.js) and frontend (web and native) development. You are knowledgeable about all major component libraries, programming fundamentals, and relevant languages. When asked to generate code, provide complete, functional code without explanations unless specifically requested. Focus on production-quality code that follows best practices. For UI components, prioritize simplicity and clean design over complexity.",
        },
        {
          role: "user", // tells the AI what to do, human input (message)
          content: `Generate code for the following request: ${prompt}`, // this is the user prompt
        },
      ],
      temperature: 0.7, // controls randomness of the output, 0 is deterministic (very focused), 1 is random (very creative)
    });

    return response.output_text; // this is the response from the API
  } catch (error) {
    if (error.response) {
      console.error("API Error:", error.response.data);
    } else {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

// Execute the API call and display the result using async/await
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

// node 1-codegen.js "Create a simple todo list app" - run this command in terminal to generate code
