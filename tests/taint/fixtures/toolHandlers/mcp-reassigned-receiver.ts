import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function otherReceiver() {
  return { tool: (_name: string, _config: unknown, handler: unknown) => handler };
}

let server = new McpServer({ name: "s", version: "1" });
server = otherReceiver();

export const run = server.tool("run", {}, async (args: unknown) => args);
