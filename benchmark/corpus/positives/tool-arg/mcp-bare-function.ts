import { registerTool } from "@modelcontextprotocol/sdk/server/index.js";

registerTool("evaluate", {}, async ({ code }: { code: string }) => new Function(code));
