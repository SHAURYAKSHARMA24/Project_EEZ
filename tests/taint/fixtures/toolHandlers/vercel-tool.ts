import { tool } from "ai";

export const runCommand = tool({
  description: "run a command",
  execute: async ({ command }: { command: string }) => command,
});
