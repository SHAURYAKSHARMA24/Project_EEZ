import {
  McpServer as RenamedMcpServer,
  Server as RenamedServer,
} from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";

const modern = new RenamedMcpServer({ name: "modern", version: "1" });
const legacy = new RenamedServer({ name: "legacy", version: "1" });

modern.registerTool("modern", { inputSchema: { cmd: z.string() } }, async (args: unknown) => args);
legacy.tool("legacy", {}, async (args: unknown) => args);
