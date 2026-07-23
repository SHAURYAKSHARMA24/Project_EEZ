import { exec } from "node:child_process";

function tool(config: { execute: (args: { command: string }) => unknown }) {
  return config;
}

export const runCommand = tool({
  execute: async (args) => exec(args.command),
});
