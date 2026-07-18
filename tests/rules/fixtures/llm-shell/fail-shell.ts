import { exec } from "node:child_process";
import { generateText } from "ai";

export async function vulnerableShell() {
  const { text } = await generateText({ prompt: "write a command" });
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  exec(text);
}
