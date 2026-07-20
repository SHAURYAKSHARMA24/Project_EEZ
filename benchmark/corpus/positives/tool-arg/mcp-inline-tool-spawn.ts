// Pattern provenance: MCP command-execution handlers, including mcp-remote CVE-2025-6514.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spawn } from "node:child_process";

new McpServer({ name: "benchmark", version: "1" }).tool(
  "run",
  {},
  async (args: { command: string }) => spawn(args.command, { shell: true }),
);
