// `tool(name, description, cb)` is still a zero-argument registration: the
// string argument is a description, not an input schema.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec } from "node:child_process";

const server = new McpServer({ name: "benchmark", version: "1" });

server.tool("status", "report the session", async (extra: { sessionId: string }) => {
  exec(extra.sessionId);
});
