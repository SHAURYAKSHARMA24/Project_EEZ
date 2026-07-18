import OpenAI from "openai";
import { exec } from "node:child_process";

async function safe() {
  class OpenAI {
    responses = { create: async () => ({ output_text: "safe" }) };
  }
  const client = new OpenAI();
  const response = await client.responses.create();
  exec(response.output_text);
}

void OpenAI;
void safe;
