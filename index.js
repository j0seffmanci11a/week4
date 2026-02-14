#!/usr/bin/env node

/**
 * Simple MCP (Model Context Protocol) Server for Development Notes
 *
 * This server provides three tools for managing markdown notes:
 * - save_note: Save or update a note
 * - list_notes: List all available notes
 * - read_note: Read the contents of a specific note
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  TextContent,
} = require("@modelcontextprotocol/sdk/types.js");

const fs = require("fs");
const path = require("path");
const os = require("os");

// Path to the notes directory in the user's home folder
const NOTES_DIR = path.join(os.homedir(), "~/DIG4503C/week4/dev-notes");

/**
 * Slugify a string to create a valid filename
 * Converts "Project Ideas" to "project-ideas"
 */
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Ensure the notes directory exists
 */
function ensureNotesDir() {
  if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true });
  }
}

/**
 * Tool handler for "save_note"
 * Saves a note with the given title and content
 */
async function handleSaveNote(title, content) {
  ensureNotesDir();
  const filename = slugify(title) + ".md";
  const filepath = path.join(NOTES_DIR, filename);

  fs.writeFileSync(filepath, content, "utf-8");

  return {
    type: "text",
    text: `Note saved successfully: ${filename}`,
  };
}

/**
 * Tool handler for "list_notes"
 * Returns a list of all markdown files with their metadata
 */
async function handleListNotes() {
  ensureNotesDir();

  const files = fs.readdirSync(NOTES_DIR).filter((file) => file.endsWith(".md"));

  if (files.length === 0) {
    return {
      type: "text",
      text: "No notes found in ~/dev-notes/",
    };
  }

  const notesList = files
    .map((file) => {
      const filepath = path.join(NOTES_DIR, file);
      const stat = fs.statSync(filepath);
      const title = file.replace(".md", "").replace(/-/g, " ");
      const lastModified = stat.mtime.toISOString().split("T")[0];

      return `- **${title}** (${file}) - Modified: ${lastModified}`;
    })
    .join("\n");

  return {
    type: "text",
    text: `Available notes:\n\n${notesList}`,
  };
}

/**
 * Tool handler for "read_note"
 * Reads and returns the contents of a specific note
 */
async function handleReadNote(title) {
  ensureNotesDir();
  const filename = slugify(title) + ".md";
  const filepath = path.join(NOTES_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return {
      type: "text",
      text: `Note not found: ${filename}`,
    };
  }

  const content = fs.readFileSync(filepath, "utf-8");

  return {
    type: "text",
    text: content,
  };
}

/**
 * Process tool calls from the client
 */
async function processToolCall(name, args) {
  switch (name) {
    case "save_note":
      return await handleSaveNote(args.title, args.content);
    case "list_notes":
      return await handleListNotes();
    case "read_note":
      return await handleReadNote(args.title);
    default:
      return {
        type: "text",
        text: `Unknown tool: ${name}`,
      };
  }
}

/**
 * Initialize and start the MCP server
 */
async function main() {
  // Create the server instance
  const server = new Server({
    name: "dev-notes-server",
    version: "1.0.0",
  }, {
    capabilities: {
      tools: {},
    },
  });

  // Register the tools with the server
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "save_note",
        description:
          "Save a note with a title and content. Creates a markdown file in ~/dev-notes/",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The title of the note (will be converted to filename)",
            },
            content: {
              type: "string",
              description: "The content of the note in markdown format",
            },
          },
          required: ["title", "content"],
        },
      },
      {
        name: "list_notes",
        description:
          "List all available notes in ~/dev-notes/ with their titles and last-modified dates",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "read_note",
        description: "Read and return the contents of a specific note",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The title of the note to read",
            },
          },
          required: ["title"],
        },
      },
    ],
  }));

  // Handle tool calls from the client
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await processToolCall(name, args);

    return {
      content: [result],
    };
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();

  // Start the server
  await server.connect(transport);

  // Log that the server is running (to stderr so it doesn't interfere with stdio)
  console.error("Dev Notes MCP Server started successfully");
}

// Start the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
