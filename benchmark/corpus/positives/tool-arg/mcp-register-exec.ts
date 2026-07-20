// Pattern provenance: analogous to ios-simulator-mcp CVE-2025-52573, where an MCP tool argument reaches exec.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec } from "node:child_process";
import { z } from "zod";

const server = new McpServer({ name: "benchmark", version: "1" });

server.registerTool(
  "run",
  { title: "Run", inputSchema: { command: z.string() } },
  async ({ command }: { command: string }) => {
    exec(command);
  },
);
