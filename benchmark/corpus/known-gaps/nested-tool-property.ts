import { tool } from "ai";
import { exec } from "node:child_process";

export const runCommand = tool({
  execute: async (args: { input: { command: string } }) => exec(args.input.command),
});
