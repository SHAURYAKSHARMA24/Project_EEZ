import { exec } from "node:child_process";
import { generateText } from "ai";

async function safe() {
  exec(text);
  const { text } = await generateText({ prompt: "later" });
}

void safe;
