import { generateText } from "ai";
import { exec } from "node:child_process";

const allowed = new Set(["status", "version"]);

export async function run() {
  const { text } = await generateText({ model: {} as never, prompt: "action" });
  const command = allowed.has(text) ? text : "status";
  exec(command);
}
