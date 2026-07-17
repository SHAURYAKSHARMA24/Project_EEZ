import { exec } from "node:child_process";
import { generateText } from "ai";

async function safe() {
  const { text } = await generateText({ prompt: "outer" });
  return () => exec(text);
}

void safe;
