import OpenAI from "openai";
import { exec } from "node:child_process";

export async function run() {
  const client = new OpenAI();
  const response = await client.responses.create({ model: "gpt", input: "x" });
  exec(response.output_text);
}
