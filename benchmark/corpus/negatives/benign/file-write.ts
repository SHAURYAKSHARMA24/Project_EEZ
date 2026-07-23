import { generateText } from "ai";
import { writeFileSync } from "node:fs";

export async function run() {
  const { text } = await generateText({ model: {} as never, prompt: "report" });
  writeFileSync("report.txt", text);
}
