import { tool } from "ai";

export const evaluate = tool({
  execute: async ([code]: [string]) => new Function(code),
});
