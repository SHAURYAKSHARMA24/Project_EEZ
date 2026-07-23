import { exec } from "node:child_process";
import { generateText } from "ai";

export async function normalizedFlows() {
  // eez-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  exec(((await generateText({ prompt: "direct" })).text));

  const result = (await generateText({ prompt: "one hop" }));
  const command = ((result.text));
  // eez-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  exec((command));
}
