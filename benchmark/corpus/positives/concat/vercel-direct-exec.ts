import { generateText } from "ai";
import { exec } from "node:child_process";

export async function run() {
  const { text } = await generateText({ model: {} as never, prompt: "repository" });
  exec("git clone " + text);
}
