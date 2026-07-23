import { generateText } from "ai";

async function vulnerable() {
  const result = await generateText({ prompt: "code" });
  // eez-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  eval(result.text);
}

void vulnerable;
