import { generateText } from "ai";
import OpenAI from "openai";

export async function shadowGenerateText(generateText: () => Promise<{ text: string }>) {
  const result = await generateText();
  return result.text;
}

export async function shadowOpenAI(OpenAI: new () => { responses: { create(): Promise<{ output_text: string }> } }) {
  const client = new OpenAI();
  const response = await client.responses.create();
  return response.output_text;
}

export function parameterResult(result: { text: string; output_text: string }) {
  return [result.text, result.output_text];
}

const unrelated = { text: "safe", output_text: "safe" };
void unrelated.text;
void unrelated.output_text;
void generateText;
void OpenAI;
