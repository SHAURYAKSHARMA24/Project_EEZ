// `registerTool` binds tool arguments to parameter 0 only when its config
// declares `inputSchema`. Without one the callback receives `extra`.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec } from "node:child_process";

const server = new McpServer({ name: "benchmark", version: "1" });

server.registerTool("status", { title: "Status" }, async (extra: { sessionId: string }) => {
  exec(extra.sessionId);
});
