import { generateText } from "ai";

async function vulnerable() {
  const result = await generateText({ prompt: "code" });
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  eval(result.text);
}

void vulnerable;
