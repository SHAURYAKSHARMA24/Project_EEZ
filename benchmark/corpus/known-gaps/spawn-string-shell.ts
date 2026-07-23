// A string `shell` value selects an explicit shell, so this is a genuine shell
// invocation. v0.1 matches only a literal `shell: true`, so it is not detected.
import { tool } from "ai";
import { spawn } from "node:child_process";

export const runCommand = tool({
  execute: async (args: { command: string }) => spawn(args.command, { shell: "/bin/bash" }),
});
