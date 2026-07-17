import { exec } from "node:child_process";
import { generateText } from "ai";

async function safe(generateText: () => Promise<{ text: string }>) {
  const result = await generateText();
  exec(result.text);
}

void generateText;
void safe;
