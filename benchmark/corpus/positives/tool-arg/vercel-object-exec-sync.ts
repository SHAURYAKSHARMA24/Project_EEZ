import { tool } from "ai";
import { execSync } from "node:child_process";

export const runCommand = tool({
  execute: async (args: { command: string }) => execSync(args.command),
});
