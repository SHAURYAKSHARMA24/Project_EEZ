import OpenAI from "openai";
import { exec } from "node:child_process";

export async function run() {
  const client = new OpenAI();
  const response = await client.responses.create({ model: "gpt", input: "argument" });
  exec(("echo " + response.output_text) as string);
}
