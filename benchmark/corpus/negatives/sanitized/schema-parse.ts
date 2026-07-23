import { tool } from "ai";
import { exec } from "node:child_process";

const commandSchema = {
  parse(value: string): "status" | "version" {
    if (value === "status" || value === "version") return value;
    throw new Error("invalid command");
  },
};

export const runCommand = tool({
  execute: async (args: { command: string }) => {
    const command = commandSchema.parse(args.command);
    exec(command);
  },
});
