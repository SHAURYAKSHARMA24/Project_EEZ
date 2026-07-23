import { exec } from "node:child_process";
import { generateText } from "ai";

// Model output interpolated directly into the shell argument is a flow.
export async function interpolated() {
  const result = await generateText({ prompt: "one" });
  // eez-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  exec(`deploy ${result.text} now`);
}

// A one-hop const alias interpolated into the shell argument is still a flow.
export async function aliasedInterpolation() {
  const result = await generateText({ prompt: "two" });
  const command = result.text;
  // eez-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  exec(`deploy ${command}`);
}

// A literal interpolation with no model output must not flow.
export async function safeInterpolation() {
  const name = "world";
  exec(`echo ${name}`);
}
