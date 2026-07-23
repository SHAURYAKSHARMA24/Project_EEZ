import { generateText } from "ai";

async function intentionalFixture() {
  const result = await generateText({ prompt: "command" });
  // eez-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  eval(result.text);
}

void intentionalFixture;
