#!/usr/bin/env node
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { ChatAnthropic } = require("@langchain/anthropic");
const { tool } = require("@langchain/core/tools");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { createToolCallingAgent, AgentExecutor } = require("langchain/agents");
const { z } = require("zod");

dotenv.config();

// Define the components directory
const COMPONENTS_DIR = "./src/components";

/**
 * Extracts metadata from component documentation
 * @param {string} componentName - Name of the component
 * @returns {object} Metadata object
 */
function extractComponentMetadata(componentName) {
  try {
    const docPath = path.join(
      COMPONENTS_DIR,
      `${componentName.toLowerCase()}.md`
    );

    if (!fs.existsSync(docPath)) {
      return { title: componentName, description: "Component not found" };
    }

    const docsContent = fs.readFileSync(docPath, "utf-8");
    const lines = docsContent.split("\n");

    // Check if file starts with frontmatter
    if (lines[0].trim() !== "---") {
      return { title: componentName, description: "No description available" };
    }

    // Extract only title and description
    const metadata = {
      title: componentName,
      description: "No description available",
    };

    // Read until the closing frontmatter delimiter
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === "---") break;

      if (line.startsWith("title:")) {
        metadata.title = line.split(":")[1].trim();
      } else if (line.startsWith("description:")) {
        metadata.description = line.split(":")[1].trim();
      }
    }

    return metadata;
  } catch (error) {
    console.error(
      `Error reading metadata for ${componentName}: ${error.message}`
    );
    return { title: componentName, description: "Error reading metadata" };
  }
}

/**
 * Gets a list of all available component docs from the components directory
 * @returns {Array} List of available component names
 */
function getAvailableComponents() {
  try {
    // Get all markdown files in the components directory
    const componentFiles = fs
      .readdirSync(COMPONENTS_DIR)
      .filter((file) => file.endsWith(".md"))
      .map((file) => file.replace(".md", ""));

    return componentFiles;
  } catch (error) {
    console.error(`Error reading components directory: ${error.message}`);
    return [];
  }
}

/**
 * Gets metadata for all components
 * @returns {string} JSON string of component metadata
 */
function getAllComponentMetadata() {
  const components = getAvailableComponents();
  const metadata = {};

  components.forEach((component) => {
    const meta = extractComponentMetadata(component);
    if (meta) {
      metadata[component] = meta;
    }
  });

  return JSON.stringify(metadata, null, 2);
}

/**
 * Gets documentation for a specific component
 * @param {string} componentName - Name of the component without .md extension
 * @returns {string} Documentation content
 */
function getComponentDocs(componentName) {
  try {
    // Build the path to the component's markdown file
    const docPath = path.join(
      COMPONENTS_DIR,
      `${componentName.toLowerCase()}.md`
    );

    // Check if the file exists
    if (!fs.existsSync(docPath)) {
      return `Documentation not found for component: ${componentName}`;
    }

    // Read the markdown file
    const docsContent = fs.readFileSync(docPath, "utf-8");
    return (
      docsContent || `Empty documentation file for component: ${componentName}`
    );
  } catch (error) {
    return `Error retrieving documentation for ${componentName}: ${error.message}`;
  }
}

/**
 * Main function to run the design system generator
 */
async function main() {
  // Check if API key is set
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is not set.");
    process.exit(1);
  }

  // Get the query from command line arguments
  const query = process.argv.slice(2).join(" ");

  if (!query) {
    console.error("Error: No query provided.");
    console.error(
      'Example: node design-system-generator.js "create a very basic login screen using my design system only"'
    );
    process.exit(1);
  }

  // Get the list of available components
  const availableComponents = getAvailableComponents();

  if (availableComponents.length === 0) {
    console.error(
      `Error: No markdown documentation files found in ${COMPONENTS_DIR}`
    );
    process.exit(1);
  }

  console.log(
    `Found ${availableComponents.length} component documentation files in your design system`
  );
  console.log("Components:", availableComponents.join(", "));

  // Create tools using the newer tool helper function
  const getComponentDocsTool = tool(
    async ({ componentName }) => {
      console.log(`📖 Reading full documentation for: ${componentName}`);
      return getComponentDocs(componentName.trim());
    },
    {
      name: "get_component_docs",
      description:
        "Gets full documentation for a specific component. Use this ONLY after selecting components based on metadata.",
      schema: z.object({
        componentName: z
          .string()
          .describe("The name of the component without .md extension"),
      }),
    }
  );

  const getComponentMetadataTool = tool(
    async () => {
      console.log("🔍 Reading component metadata...");
      return getAllComponentMetadata();
    },
    {
      name: "get_component_metadata",
      description:
        "Gets metadata (title and description) for all components. Use this FIRST to decide which components are relevant.",
      schema: z.object({}),
    }
  );

  const selectComponentsTool = tool(
    async ({ selectedComponents }) => {
      console.log(`✅ Selected components: ${selectedComponents.join(", ")}`);
      return `You have selected: ${selectedComponents.join(
        ", "
      )}. Now proceed to get full documentation for these components only.`;
    },
    {
      name: "select_components",
      description:
        "After reading component metadata, use this to select which components you need for the task. This helps track which components to read fully.",
      schema: z.object({
        selectedComponents: z
          .array(z.string())
          .describe("Array of component names that are relevant for the task"),
      }),
    }
  );

  const tools = [
    getComponentMetadataTool,
    selectComponentsTool,
    getComponentDocsTool,
  ];

  // Initialize the Claude language model
  const llm = new ChatAnthropic({
    model: "claude-3-5-sonnet-20240620",
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a React expert specializing in the provided design system.
      
      STRICT WORKFLOW (follow in order):
      1. Use the get_component_metadata tool to see titles and descriptions
      2. Use the select_components tool to explicitly select which components you need
      3. Use get_component_docs tool ONLY for the components you selected
      4. Generate the React component code
      
      REQUIREMENTS:
      - Use ONLY components from the documented design system
      - NO HTML tags like <div>, <button>, <input>, etc.
      - NO external component libraries
      - NO StyleSheet or styles objects - use ONLY Tailwind CSS classes
      - All components accept Tailwind CSS classes via the className prop
      - Images should be ONLY from unsplash.com - NO local images
      - Components should be imported individually from their respective files, not grouped together in a single import statement.
      - Output ONLY the complete React component code, no explanations
      - All generated screens or components should be SCROLLABLE. Use ScrollView or a similar component from the design system to ensure content is properly scrollable.
      - All generated screens or components should be responsive and mobile-friendly (with some horizontal margin and padding).
      - PREFER to use HStack and VStack components over Box components whenever possible
      
      OPTIMIZATION:
      - Select the minimum number of components needed
      - Base selection on metadata relevance to the task
      - Only read full documentation for selected components
      
      CRITICAL: You MUST generate COMPLETE and RUNNABLE code. Do not truncate or abbreviate any part of the implementation. If the component is large, focus on generating a complete, working version rather than including every possible feature.`,
    ],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  const agent = await createToolCallingAgent({
    llm,
    tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    verbose: false,
    maxIterations: 30, // Increase the maximum number of iterations by default around 10
  });

  try {
    console.log(`\n🚀 Processing request: "${query}"`);
    console.log("Analyzing component metadata and generating code...\n");

    const result = await agentExecutor.invoke({
      input: query,
    });
    // const chain = prompt.pipe(llm);
    // const result = await chain.invoke({
    //   input: query,
    // });

    // Get the output, handling different response formats from Claude
    let finalOutput = "";

    if (typeof result.output === "string") {
      finalOutput = result.output;
    } else if (Array.isArray(result.output)) {
      if (result.output[0] && result.output[0].text) {
        finalOutput = result.output[0].text;
      } else {
        finalOutput = JSON.stringify(result.output);
      }
    } else {
      finalOutput = JSON.stringify(result);
    }

    // Clean up any result tags or syntax that might be in the output
    finalOutput = finalOutput.replace(/result\.output\[0\]\.text/g, "");
    finalOutput = finalOutput.replace(/<result>|<\/result>/g, "");
    finalOutput = finalOutput.trim();

    // Print the cleaned output code
    console.log("\n=== Generated Component Code ===\n");
    console.log(finalOutput);
    console.log("\n================================\n");
  } catch (error) {
    console.error("Error generating UI from design system:", error);
  }
}

main();
