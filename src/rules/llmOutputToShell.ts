import { findFlows, type TaintFlow } from "../taint/flow.ts";
import type { Finding, Rule, RuleContext } from "../types.ts";

const SCANNABLE = /\.(?:cjs|js|jsx|mjs|ts|tsx)$/i;

const SOURCE_LABELS: Record<TaintFlow["api"], string> = {
  "openai-responses": "OpenAI Responses output_text",
  "vercel-generateText": "Vercel AI SDK generateText().text",
  "tool-parameter": "AI tool call argument",
};

const SINK_LABELS: Record<TaintFlow["sinkKind"], string> = {
  exec: "child_process.exec",
  execSync: "child_process.execSync",
  eval: "global eval",
  "function-constructor": "global Function",
  "spawn-shell": "child_process.spawn (shell: true)",
};

const SHELL_FIX =
  "Use a fixed executable with an allowlisted argument array via execFile, or expose structured tools whose inputs are validated before dispatch.";
const EVALUATOR_FIX =
  "Do not dynamically evaluate model output. Parse and validate a constrained action, then dispatch only known cases.";

function findings(ctx: RuleContext): Finding[] {
  const file = ctx.analysis?.files.get(ctx.filePath);
  if (!ctx.analysis || !file) return [];

  return findFlows(ctx.analysis.checker, file).map((flow) => {
    const source = SOURCE_LABELS[flow.api];
    const sink = SINK_LABELS[flow.sinkKind];
    const shell = flow.sinkKind === "exec" || flow.sinkKind === "execSync" || flow.sinkKind === "spawn-shell";
    return {
      ruleId: "llm-output-to-shell",
      tier: "check",
      title: shell ? "LLM output reaches shell execution" : "LLM output reaches dynamic evaluation",
      file: ctx.filePath,
      line: flow.sinkLine,
      confidence: "high",
      source,
      sink,
      message:
        `${source} at source line ${flow.sourceLine} flows into ${sink} at sink line ${flow.sinkLine}. `
        + "Model output can become executable code.",
      fix: shell ? SHELL_FIX : EVALUATOR_FIX,
    };
  });
}

export const llmOutputToShell: Rule = {
  id: "llm-output-to-shell",
  tier: "check",
  appliesTo: (path) => SCANNABLE.test(path),
  run: findings,
};
