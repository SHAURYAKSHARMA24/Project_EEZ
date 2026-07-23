import { generateText } from "ai";

export async function run() {
  const { text } = await generateText({ model: {} as never, prompt: "expression" });
  eval(text);
}
