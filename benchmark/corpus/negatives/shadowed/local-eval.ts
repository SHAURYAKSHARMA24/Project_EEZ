import { generateText } from "ai";

export async function run() {
  const { text } = await generateText({ model: {} as never, prompt: "message" });
  const eval = (value: string) => value.length;
  return eval(text);
}
