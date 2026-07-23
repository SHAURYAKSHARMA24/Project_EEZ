import { generateText } from "ai";
import { exec } from "node:child_process";

async function vulnerable() {
  const { text: command } = await generateText({ prompt: "command" });
  // eez-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  exec(command);
}

void vulnerable;
