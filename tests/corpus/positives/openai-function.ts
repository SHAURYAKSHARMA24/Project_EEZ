import OpenAI from "openai";

async function vulnerable() {
  const client = new OpenAI();
  const response = await client.responses.create({ input: "function body" });
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  new Function("value", response.output_text);
}

void vulnerable;
