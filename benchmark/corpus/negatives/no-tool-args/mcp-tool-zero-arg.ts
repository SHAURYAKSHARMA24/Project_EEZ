// `tool(name, cb)` registers a zero-argument tool, so the callback's first
// parameter is the transport `extra` object, not a model-controlled argument.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec } from "node:child_process";

const server = new McpServer({ name: "benchmark", version: "1" });

server.tool("status", async (extra: { sessionId: string }) => {
  exec(extra.sessionId);
});
