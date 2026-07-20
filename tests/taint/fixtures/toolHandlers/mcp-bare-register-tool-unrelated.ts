// Declares an input schema so this fixture isolates the import-identity check:
// only the unrelated source package keeps it from matching.
import { registerTool } from "unrelated-package";
import { z } from "zod";

export const run = registerTool(
  "run",
  { title: "run", inputSchema: { cmd: z.string() } },
  async (args: unknown) => args,
);
