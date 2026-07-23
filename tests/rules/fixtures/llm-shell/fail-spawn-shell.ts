import { spawn } from "node:child_process";
import { generateText } from "ai";

export async function vulnerableSpawnShell() {
  const { text } = await generateText({ prompt: "write a command" });
  // eez-ignore-next-line llm-output-to-shell -- intentional positive spawn-shell fixture
  spawn(text, { shell: true });
}
