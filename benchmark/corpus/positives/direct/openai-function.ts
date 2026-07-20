import OpenAI from "openai";

export async function run() {
  const client = new OpenAI();
  const response = await client.responses.create({ model: "gpt", input: "function body" });
  return new Function(response.output_text);
}
