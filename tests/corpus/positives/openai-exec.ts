import OpenAI from "openai";
import { exec } from "node:child_process";

async function vulnerable() {
  const client = new OpenAI();
  const response = await client.responses.create({ input: "command" });
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  exec(response.output_text);
}

void vulnerable;
