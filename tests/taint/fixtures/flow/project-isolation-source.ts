import { generateText } from "ai";

const { text } = await generateText({ prompt: "source module" });
void text;
