import OpenAI from "openai";
import { exec } from "node:child_process";

// The idiomatic singleton pattern: the client is constructed once in module
// scope and reused by request handlers declared in nested scopes.
const client = new OpenAI();

async function run() {
  const response = await client.responses.create({ input: "command" });
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  exec(response.output_text);
}

void run;
