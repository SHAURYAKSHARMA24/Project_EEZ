import { tool } from "ai";
import { exec } from "node:child_process";

export const property = tool({
  execute: async (args: { cmd: string }) => {
    const command = args.cmd;
    // eez-ignore-next-line llm-output-to-shell -- intentional positive tool-property const fixture
    exec(command);
  },
});

export const element = tool({
  execute: async (args: { cmd: string }) => {
    const command = args["cmd"];
    // eez-ignore-next-line llm-output-to-shell -- intentional positive tool-element const fixture
    exec(command);
  },
});
