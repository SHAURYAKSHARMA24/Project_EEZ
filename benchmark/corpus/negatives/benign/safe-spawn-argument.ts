import OpenAI from "openai";
import { spawn } from "node:child_process";

export async function run() {
  const client = new OpenAI();
  const response = await client.responses.create({ model: "gpt", input: "message" });
  spawn("printf", ["%s", response.output_text], { shell: false });
}
