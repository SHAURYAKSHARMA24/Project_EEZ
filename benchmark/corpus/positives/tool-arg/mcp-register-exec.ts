// Pattern provenance: MCP command-execution handlers, including mcp-remote CVE-2025-6514.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec } from "node:child_process";

const server = new McpServer({ name: "benchmark", version: "1" });

server.registerTool("run", { title: "Run" }, async ({ command }: { command: string }) => {
  exec(command);
});
