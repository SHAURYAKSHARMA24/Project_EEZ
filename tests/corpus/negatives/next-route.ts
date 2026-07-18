import { generateText } from "ai";

export async function GET() {
  const { text } = await generateText({ prompt: "message" });
  return Response.json({ text });
}
