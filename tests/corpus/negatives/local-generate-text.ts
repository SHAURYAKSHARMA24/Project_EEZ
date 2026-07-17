import { generateText } from "ai";
import { exec } from "node:child_process";

async function safe() {
  const generateText = async () => ({ text: "safe" });
  const result = await generateText();
  exec(result.text);
}

void generateText;
void safe;
