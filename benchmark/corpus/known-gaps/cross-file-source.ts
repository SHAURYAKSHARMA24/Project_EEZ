import { generateText } from "ai";

const result = await generateText({ model: {} as never, prompt: "command" });
export const command = result.text;
