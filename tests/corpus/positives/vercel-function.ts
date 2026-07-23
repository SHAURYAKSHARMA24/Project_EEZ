import { generateText } from "ai";

async function vulnerable() {
  // eez-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  Function(((await generateText({ prompt: "function body" })).text));
}

void vulnerable;
