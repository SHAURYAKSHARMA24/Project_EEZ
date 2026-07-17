import { execFile } from "node:child_process";
import { generateText } from "ai";

export async function safeUse() {
  const result = await generateText({ prompt: "choose a label" });
  console.log(result.text);
  execFile("echo", [result.text]);
}
