import OpenAI from "openai";
import { exec } from "node:child_process";

// A genuine module-scoped OpenAI client exists...
const client = new OpenAI();

async function safe() {
  // ...but a local binding of the same name shadows it, and the local value is
  // not an OpenAI client, so its output must not be treated as tainted.
  const client = {
    responses: { create: async () => ({ output_text: "safe" }) },
  };
  const response = await client.responses.create();
  exec(response.output_text);
}

void client;
void safe;
