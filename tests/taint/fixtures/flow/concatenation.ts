import { generateText } from "ai";
import { exec } from "node:child_process";

export async function direct() {
  const { text } = await generateText({ model: {} as never, prompt: "p" });
  // eez-ignore-next-line llm-output-to-shell -- intentional positive concatenation fixture
  exec("git clone " + text);
}

export async function throughConst() {
  const { text } = await generateText({ model: {} as never, prompt: "p" });
  const command = "git clone " + text;
  // eez-ignore-next-line llm-output-to-shell -- intentional positive concatenation fixture
  exec(command);
}

export async function safe() {
  const { text } = await generateText({ model: {} as never, prompt: "p" });
  const label = "prefix" + "suffix";
  exec("echo " + label + " done" + " " + "static");
  void text;
}
