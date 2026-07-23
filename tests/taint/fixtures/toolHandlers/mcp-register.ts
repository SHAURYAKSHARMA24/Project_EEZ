import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "s", version: "1" });

server.registerTool(
  "run",
  { title: "run", inputSchema: { cmd: z.string() } },
  async ({ cmd }: { cmd: string }) => ({
    content: [{ type: "text", text: cmd }],
  }),
);
