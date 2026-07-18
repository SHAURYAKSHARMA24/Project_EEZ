import { execSync } from "node:child_process";
import { generateText } from "ai";

async function safe(execSync: (value: string) => void) {
  const { text } = await generateText({ prompt: "value" });
  execSync(text);
}

void execSync;
void safe;
