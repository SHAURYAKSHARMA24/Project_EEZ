import { generateText } from "ai";

class Function {
  constructor(readonly body: string) {}
}

export async function run() {
  const { text } = await generateText({ model: {} as never, prompt: "message" });
  return new Function(text);
}
