import OpenAI from "openai";
import * as cp from "child_process";

async function vulnerable() {
  const client = new OpenAI();
  const response = await client.responses.create({ input: "command" });
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  cp.execSync(response.output_text);
}

void vulnerable;
