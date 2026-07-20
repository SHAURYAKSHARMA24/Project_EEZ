import { tool } from "ai";
import { spawn } from "node:child_process";

export const runCommand = tool({
  execute: async ({ command }: { command: string }) => {
    // preflight-ignore-next-line llm-output-to-shell -- intentional positive tool-argument spawn-shell fixture
    spawn(command, { shell: true });
  },
});
