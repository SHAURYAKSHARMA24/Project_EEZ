// `registerTool` config without `inputSchema`: parameter 0 is `extra`.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({ name: "s", version: "1" });

server.registerTool("status", { title: "Status" }, async (extra: unknown) => extra);
