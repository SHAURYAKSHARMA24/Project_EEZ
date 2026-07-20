import OpenAI from "openai";
import { exec } from "node:child_process";

export async function run() {
  const client = new OpenAI();
  const response = await client.responses.create({ model: "gpt", input: "service name" });
  const service = /^[a-z0-9-]+$/.test(response.output_text) ? response.output_text : "default";
  exec("systemctl status " + service);
}
