import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({ name: "s", version: "1" });

server.registerTool("run", { title: "run" }, async ({ cmd }: { cmd: string }) => ({
  content: [{ type: "text", text: cmd }],
}));
