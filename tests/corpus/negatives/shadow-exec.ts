import { exec } from "node:child_process";
import { generateText } from "ai";

async function safe(exec: (value: string) => void) {
  const { text } = await generateText({ prompt: "value" });
  exec(text);
}

void exec;
void safe;
