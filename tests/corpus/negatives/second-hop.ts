import { exec } from "node:child_process";
import { generateText } from "ai";

async function safe() {
  const { text } = await generateText({ prompt: "value" });
  const first = text;
  const second = first;
  exec(second);
}

void safe;
