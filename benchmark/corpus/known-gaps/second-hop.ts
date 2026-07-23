import { generateText } from "ai";
import { exec } from "node:child_process";

export async function run() {
  const { text } = await generateText({ model: {} as never, prompt: "command" });
  const first = text;
  const second = first;
  exec(second);
}
