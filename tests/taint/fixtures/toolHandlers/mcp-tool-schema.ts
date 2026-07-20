// Deprecated `tool(...)` forms that do declare a params schema, with and
// without a leading description. Parameter 0 is the model-controlled argument.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "s", version: "1" });

server.tool("run", { command: z.string() }, async (args: { command: string }) => args);
server.tool(
  "described",
  "runs a command",
  { command: z.string() },
  async (args: { command: string }) => args,
);
