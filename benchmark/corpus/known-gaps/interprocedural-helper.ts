import { generateText } from "ai";
import { exec } from "node:child_process";

function runCommand(command: string) {
  exec(command);
}

export async function run() {
  const { text } = await generateText({ model: {} as never, prompt: "command" });
  runCommand(text);
}
