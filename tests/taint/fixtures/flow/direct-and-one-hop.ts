import { exec, execSync } from "node:child_process";
import { generateText } from "ai";

export async function directAndOneHop() {
  const { text } = await generateText({ prompt: "one" });
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  exec(text);

  const result = await generateText({ prompt: "two" });
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  eval(result.text);

  const command = text;
  // preflight-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture
  execSync(command);

  const a = text;
  const b = a;
  exec(b);

  let mutable = text;
  exec(mutable);
  mutable = "safe";
}
