import OpenAI from "openai";
import { exec } from "node:child_process";

const actions = { status: "git status", version: "git --version", help: "git help" } as const;

export async function run() {
  const client = new OpenAI();
  const response = await client.responses.create({ model: "gpt", input: "action" });
  const key = response.output_text as keyof typeof actions;
  const command = actions[key] ?? actions.help;
  exec(command);
}
