import {
  McpServer as RenamedMcpServer,
  Server as RenamedServer,
} from "@modelcontextprotocol/sdk/server/index.js";

const modern = new RenamedMcpServer({ name: "modern", version: "1" });
const legacy = new RenamedServer({ name: "legacy", version: "1" });

modern.registerTool("modern", {}, async (args: unknown) => args);
legacy.tool("legacy", {}, async (args: unknown) => args);
