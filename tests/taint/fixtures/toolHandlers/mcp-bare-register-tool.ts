import { registerTool } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";

export const run = registerTool(
  "run",
  { title: "run", inputSchema: { cmd: z.string() } },
  async ({ cmd }: { cmd: string }) => ({
    content: [{ type: "text", text: cmd }],
  }),
);
