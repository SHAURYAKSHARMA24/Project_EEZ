import OpenAI from "openai";
import * as childProcess from "node:child_process";

export async function run() {
  const client = new OpenAI();
  const response = await client.responses.create({ model: "gpt", input: "command" });
  childProcess.exec(response.output_text);
}
