import { tool } from "ai";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const destructured = tool({
  execute: async ({ command }: { command: string }) => command,
});

const server = new McpServer({ name: "s", version: "1" });
server.registerTool("run", { title: "run" }, async (args: { cmd: string }) => ({
  content: [{ type: "text", text: args.cmd }],
}));
