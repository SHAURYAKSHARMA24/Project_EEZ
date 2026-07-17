import { generateText } from "ai";

async function safe(eval: (value: string) => void) {
  const { text } = await generateText({ prompt: "value" });
  eval(text);
}

void safe;
