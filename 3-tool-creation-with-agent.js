// an agent in langchain is a smart AI that can think and act on its own. Can decide when to use specific tools.
// an agent executor is a tool that can execute the agent's decisions.

const dotenv = require("dotenv");
const { ChatOpenAI } = require("@langchain/openai");
const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { createToolCallingAgent, AgentExecutor } = require("langchain/agents");

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

function getWeather(location) {
  const weatherData = {
    bangalore: "cloudy with a temperature of 28 degrees Celsius",
    mumbai: "partly cloudy with a temperature of 30 degrees Celsius",
    delhi: "sunny with a temperature of 35 degrees Celsius",
    chennai: "rainy with a temperature of 26 degrees Celsius",
  };

  return (
    weatherData[location.toLowerCase()] ||
    `Unable to retrieve weather data for ${location}`
  );
}

const getWeatherTool = tool(
  async ({ location }) => {
    return getWeather(location);
  },
  {
    name: "getWeather",
    description: "Get the weather for a specific location",
    schema: z.object({ location: z.string() }),
  }
);

console.log("Generating code based on your request...");

async function generateCode() {
  try {
    const tools = [getWeatherTool];

    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
      apiKey: apiKey,
      temperature: 0.7,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "You are a full-stack development expert skilled in both backend (Node.js) and frontend (web and native) development. You are knowledgeable about all major component libraries, programming fundamentals, and relevant languages. When asked to generate code, provide complete, functional code without explanations unless specifically requested. Focus on production-quality code that follows best practices. For UI components, prioritize simplicity and clean design over complexity. You can access weather information for certain locations if needed.",
      ],
      ["human", "{input}"],
      ["placeholder", "{agent_scratchpad}"],
    ]);

    /** Without the {agent_scratchpad}, the agent wouldn't be able to:
      - Remember which tools it has already called
      - See the results of those tool calls
      - Make decisions based on previous steps
    */

    const agent = createToolCallingAgent({
      llm,
      tools,
      prompt,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: false, // controls whether detailed information is shown during the agent's execution.
    });

    const response = await agentExecutor.invoke({
      input: query,
    });

    return response;
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Execute the function and display the result
(async () => {
  try {
    const result = await generateCode();
    console.log("\n--- GENERATED CODE ---\n");
    console.log(result.output);
    console.log("\n--- END OF GENERATED CODE ---");
  } catch (err) {
    console.error("An unexpected error occurred:", err);
  }
})();

// node 3-tool-creation-with-agent "What is the weather in Delhi?"
