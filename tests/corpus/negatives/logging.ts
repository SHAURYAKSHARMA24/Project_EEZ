import { generateText } from "ai";

async function safe() {
  const result = await generateText({ prompt: "message" });
  console.log(result.text);
}

void safe;
