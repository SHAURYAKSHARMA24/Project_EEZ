// The three deprecated `tool(...)` forms that register a zero-argument tool.
// In each the callback's parameter 0 is the transport `extra` object.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({ name: "s", version: "1" });

server.tool("zeroArg", async (extra: unknown) => extra);
server.tool("described", "a description", async (extra: unknown) => extra);
server.tool(
  "annotated",
  { title: "Annotated", readOnlyHint: true },
  async (extra: unknown) => extra,
);
