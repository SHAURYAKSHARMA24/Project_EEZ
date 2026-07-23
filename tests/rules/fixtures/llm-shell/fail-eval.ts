import OpenAI from "openai";

export async function vulnerableEval() {
  const client = new OpenAI();
  const response = await client.responses.create({ input: "write code" });
  // eez-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  eval(response.output_text);
}
