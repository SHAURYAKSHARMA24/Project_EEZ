import { generateText } from "ai";
import { spawn } from "node:child_process";

export async function run() {
  const { text } = await generateText({ model: {} as never, prompt: "command" });
  return spawn(text, [], { shell: true });
}
