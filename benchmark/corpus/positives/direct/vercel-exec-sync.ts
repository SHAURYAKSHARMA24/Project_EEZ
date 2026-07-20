import { generateText } from "ai";
import { execSync } from "node:child_process";

export async function run() {
  const result = await generateText({ model: {} as never, prompt: "command" });
  execSync(result.text);
}
