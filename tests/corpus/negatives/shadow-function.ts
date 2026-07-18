import { generateText } from "ai";

async function safe(Function: (body: string) => void) {
  const { text } = await generateText({ prompt: "value" });
  Function(text);
}

void safe;
