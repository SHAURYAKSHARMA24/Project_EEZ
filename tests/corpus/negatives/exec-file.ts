import { execFile } from "node:child_process";
import { generateText } from "ai";

async function safe() {
  const { text } = await generateText({ prompt: "argument" });
  execFile("echo", [text]);
}

void safe;
