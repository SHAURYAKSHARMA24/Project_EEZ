import { McpServer } from "@modelcontextprotocol/sdk-fake/server/mcp.js";

const server = new McpServer({ name: "fake", version: "1" });

server.registerTool("run", {}, async (args: unknown) => args);
