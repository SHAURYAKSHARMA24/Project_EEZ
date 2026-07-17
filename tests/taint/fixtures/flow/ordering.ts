import { exec } from "node:child_process";
import { generateText } from "ai";

export async function backwardFlow() {
  exec(text);
  const { text } = await generateText({ prompt: "later" });
}
