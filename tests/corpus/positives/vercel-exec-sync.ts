import { generateText } from "ai";
import { execSync as runSync } from "node:child_process";

async function vulnerable() {
  const result = await generateText({ prompt: "command" });
  // eez-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  runSync(result.text);
}

void vulnerable;
