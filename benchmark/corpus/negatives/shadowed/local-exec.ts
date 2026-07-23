import { generateText } from "ai";

function exec(value: string) {
  return value.length;
}

export async function run() {
  const { text } = await generateText({ model: {} as never, prompt: "message" });
  return exec(text);
}
