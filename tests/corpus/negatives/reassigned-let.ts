import { exec } from "node:child_process";
import { generateText } from "ai";

async function safe() {
  const { text } = await generateText({ prompt: "value" });
  let command = text;
  command = "fixed";
  exec(command);
}

void safe;
