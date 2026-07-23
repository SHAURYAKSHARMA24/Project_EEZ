import OpenAI from "openai";
import { execSync } from "node:child_process";

export async function run() {
  const client = new OpenAI();
  const response = await client.responses.create({ model: "gpt", input: "branch" });
  const command = "git checkout " + response.output_text;
  execSync(command);
}
