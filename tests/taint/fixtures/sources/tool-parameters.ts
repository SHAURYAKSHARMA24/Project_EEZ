import { tool } from "ai";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const destructured = tool({
  execute: async ({ command }: { command: string }) => command,
});

const server = new McpServer({ name: "s", version: "1" });
server.registerTool(
  "run",
  { title: "run", inputSchema: { cmd: z.string() } },
  async (args: { cmd: string }) => ({
    content: [{ type: "text", text: args.cmd }],
  }),
);
