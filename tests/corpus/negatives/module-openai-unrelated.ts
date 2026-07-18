import { exec } from "node:child_process";

// A module-scoped object that merely shares the `client` name and the
// `responses.create` shape is not an OpenAI client and must not taint output.
const client = {
  responses: { create: async () => ({ output_text: "safe" }) },
};

async function safe() {
  const response = await client.responses.create();
  exec(response.output_text);
}

void safe;
