import { generateText } from "ai";

export async function safeResponse() {
  const result = await generateText({ prompt: "message" });
  return new Response(result.text);
}
