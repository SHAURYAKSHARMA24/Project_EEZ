import { generateText } from "ai";

export async function vercelSources() {
  const { text } = await generateText({ prompt: "one" });
  const { text: output } = (await generateText({ prompt: "two" }));
  const result = await generateText({ prompt: "three" });
  const later = result.text;
  const direct = ((await generateText({ prompt: "four" }))).text;
  return { text, output, later, direct };
}
