import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/ast/analysis.ts";
import { llmOutputToShell } from "../../src/rules/llmOutputToShell.ts";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "positives");
const matrix = [
  ["openai-exec.ts", "OpenAI Responses output_text", "child_process.exec"],
  ["openai-exec-sync.ts", "OpenAI Responses output_text", "child_process.execSync"],
  ["openai-eval.ts", "OpenAI Responses output_text", "global eval"],
  ["openai-function.ts", "OpenAI Responses output_text", "global Function"],
  ["vercel-exec.ts", "Vercel AI SDK generateText().text", "child_process.exec"],
  ["vercel-exec-sync.ts", "Vercel AI SDK generateText().text", "child_process.execSync"],
  ["vercel-eval.ts", "Vercel AI SDK generateText().text", "global eval"],
  ["vercel-function.ts", "Vercel AI SDK generateText().text", "global Function"],
] as const;

describe("M1a positive acceptance matrix", () => {
  it.each(matrix)("detects exactly one flow in %s", (name, source, sink) => {
    const content = readFileSync(join(fixtureRoot, name), "utf8");
    const analysis = analyzeProject([{ path: name, content }]);
    const findings = llmOutputToShell.run({
      filePath: name,
      content,
      isGitTracked: false,
      analysis,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "llm-output-to-shell",
      tier: "check",
      source,
      sink,
    });
    expect(findings[0].source).not.toBe("");
    expect(findings[0].sink).not.toBe("");
  });
});
