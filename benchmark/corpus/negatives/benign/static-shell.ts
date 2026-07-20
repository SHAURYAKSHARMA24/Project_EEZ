import { generateText } from "ai";
import { exec } from "node:child_process";

export async function run() {
  const { text } = await generateText({ model: {} as never, prompt: "summary" });
  console.log(text);
  exec("git status");
}
