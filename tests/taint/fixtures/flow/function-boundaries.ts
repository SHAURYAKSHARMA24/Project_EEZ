import { exec } from "node:child_process";
import { generateText } from "ai";

export async function outerOwner() {
  const { text } = await generateText({ prompt: "outer" });
  const callback = () => exec(text);
  function siblingCapture() {
    eval(text);
  }
  return { callback, siblingCapture };
}

export function safeSibling() {
  const text = "safe";
  exec(text);
}
