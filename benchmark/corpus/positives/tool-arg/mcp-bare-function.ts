// Pattern provenance: MCP command-execution handlers, including mcp-remote CVE-2025-6514.
import { registerTool } from "@modelcontextprotocol/sdk/server/index.js";

registerTool("evaluate", {}, async ({ code }: { code: string }) => new Function(code));
