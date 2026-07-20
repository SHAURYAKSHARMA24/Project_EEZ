import { tool } from "ai";

export const evaluate = tool({
  execute: async (args: { code: string }) => eval("void " + args.code),
});
