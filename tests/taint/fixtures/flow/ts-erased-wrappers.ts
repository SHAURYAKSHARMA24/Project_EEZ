import { exec } from "node:child_process";
import { generateText } from "ai";

// `as` assertion on the sink argument.
export async function asOnSink() {
  const result = await generateText({ prompt: "as" });
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  exec(result.text as string);
}

// Non-null assertion on the sink argument.
export async function nonNullOnSink() {
  const result = await generateText({ prompt: "non-null" });
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  exec(result.text!);
}

// `satisfies` assertion on the sink argument.
export async function satisfiesOnSink() {
  const result = await generateText({ prompt: "satisfies" });
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  exec(result.text satisfies string);
}

// Angle-bracket type assertion on the sink argument (legal in .ts, not .tsx).
export async function angleBracketOnSink() {
  const result = await generateText({ prompt: "angle" });
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  exec(<string>result.text);
}

// Erased wrappers on the source binding and nested wrappers on the sink argument.
export async function wrappedSourceAndSink() {
  const result = (await generateText({ prompt: "src" })) as { text: string };
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  exec((result.text as string)!);
}

// Assertions must not manufacture a flow where no model output is present.
export async function assertedNonSource() {
  const value = "safe" as string;
  exec(value!);
}
