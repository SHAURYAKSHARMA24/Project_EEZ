import { registerTool } from "@modelcontextprotocol/sdk/server/index.js";

export const run = registerTool("run", { title: "run" }, async ({ cmd }: { cmd: string }) => ({
  content: [{ type: "text", text: cmd }],
}));
