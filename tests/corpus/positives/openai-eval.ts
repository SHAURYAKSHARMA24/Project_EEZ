import OpenAI from "openai";

async function vulnerable() {
  const client = new OpenAI();
  const response = await client.responses.create({ input: "code" });
  // eez-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  eval(response.output_text);
}

void vulnerable;
