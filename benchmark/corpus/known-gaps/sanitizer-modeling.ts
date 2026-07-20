import { tool } from "ai";
import { exec } from "node:child_process";

const ALLOWED_COMMANDS = new Set(["status", "version"]);

export const runCommand = tool({
  execute: async (args: { command: string }) => {
    if (!ALLOWED_COMMANDS.has(args.command)) {
      throw new Error("Command is not allowed");
    }

    exec(args.command);
  },
});
