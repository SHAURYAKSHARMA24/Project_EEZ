import { tool } from "ai";
import { exec } from "node:child_process";

export const runCommand = tool({
  execute: async ({ command }: { command: string }) => exec(command),
});
