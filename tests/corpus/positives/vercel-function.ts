import { generateText } from "ai";

async function vulnerable() {
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  Function(((await generateText({ prompt: "function body" })).text));
}

void vulnerable;
