import { exec } from "node:child_process";
import { generateText } from "ai";

async function sourceSibling() {
  const { text } = await generateText({ prompt: "source" });
  return text;
}

function sinkSibling() {
  const text = "safe";
  exec(text);
}

void sourceSibling;
void sinkSibling;
