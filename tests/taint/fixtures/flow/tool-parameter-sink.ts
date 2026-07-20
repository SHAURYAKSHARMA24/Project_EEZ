import { tool } from "ai";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec } from "node:child_process";

export const destructured = tool({
  execute: async ({ command }: { command: string }) => {
    // preflight-ignore-next-line llm-output-to-shell -- intentional positive tool-parameter fixture
    exec(command);
  },
});

const server = new McpServer({ name: "s", version: "1" });
server.registerTool("run", { title: "run" }, async (args: { cmd: string }) => {
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive tool-parameter fixture
  exec(args.cmd);
  return { content: [] };
});
