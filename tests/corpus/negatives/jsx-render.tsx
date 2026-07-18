import { generateText } from "ai";

export async function SafeView() {
  const { text } = await generateText({ prompt: "message" });
  return <div>{text}</div>;
}
