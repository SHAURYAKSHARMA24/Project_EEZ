import { registerTool } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";

registerTool(
  "evaluate",
  { inputSchema: { code: z.string() } },
  async ({ code }: { code: string }) => new Function(code),
);
