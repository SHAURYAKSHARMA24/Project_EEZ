import * as cp from "node:child_process";
import { generateText } from "ai";

async function safe(cp: { exec(value: string): void }) {
  const { text } = await generateText({ prompt: "value" });
  cp.exec(text);
}

void cp;
void safe;
