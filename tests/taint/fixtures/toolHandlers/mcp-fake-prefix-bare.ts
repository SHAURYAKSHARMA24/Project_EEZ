import { registerTool } from "@modelcontextprotocol/sdk-fake/server/index.js";

export const run = registerTool("run", {}, async (args: unknown) => args);
