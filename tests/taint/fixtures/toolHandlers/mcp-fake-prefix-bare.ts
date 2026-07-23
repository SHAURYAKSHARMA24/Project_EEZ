// Declares an input schema so this fixture isolates the package-boundary check:
// only the `-fake` package suffix keeps it from matching.
import { registerTool } from "@modelcontextprotocol/sdk-fake/server/index.js";
import { z } from "zod";

export const run = registerTool(
  "run",
  { inputSchema: { cmd: z.string() } },
  async (args: unknown) => args,
);
