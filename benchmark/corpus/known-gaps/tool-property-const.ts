import { tool } from "ai";
import { exec } from "node:child_process";

export const runCommand = tool({
  execute: async (args: { command: string }) => {
    const command = args.command;
    exec(command);
  },
});
