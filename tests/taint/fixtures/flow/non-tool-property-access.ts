import { exec } from "node:child_process";
import { generateText } from "ai";

// Property access on a tainted binding is only taint-preserving when the
// binding's provenance is `tool-parameter` (see the guard in
// `resolveDirectSource`). `text` here is a `vercel-generateText` binding, so
// accessing an unrelated property on it must NOT be treated as tainted.
export async function propertyAccessOnNonToolSource() {
  const { text } = await generateText({ prompt: "one" });
  exec(text.length);
}
