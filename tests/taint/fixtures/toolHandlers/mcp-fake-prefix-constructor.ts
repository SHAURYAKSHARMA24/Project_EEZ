// Declares an input schema so this fixture isolates the package-boundary check:
// only the `-fake` package suffix keeps it from matching.
import { McpServer } from "@modelcontextprotocol/sdk-fake/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "fake", version: "1" });

server.registerTool("run", { inputSchema: { cmd: z.string() } }, async (args: unknown) => args);
