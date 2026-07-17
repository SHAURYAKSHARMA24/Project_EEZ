import OpenAI from "openai";

export async function openAiSources() {
  const client = new OpenAI();
  const response = await client.responses.create({ input: "one" });
  const saved = response.output_text;
  const direct = ((await client.responses.create({ input: "two" }))).output_text;
  return { saved, direct };
}
