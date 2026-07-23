import { exec } from "node:child_process";
import { z } from "zod";

const server = {
  registerTool(
    _name: string,
    _config: unknown,
    handler: (args: { command: string }) => unknown,
  ) {
    return handler;
  },
};

// Declares an input schema so this case isolates the receiver-identity check:
// only the plain-object receiver keeps it from matching.
server.registerTool("run", { inputSchema: { command: z.string() } }, async (args) =>
  exec(args.command));
