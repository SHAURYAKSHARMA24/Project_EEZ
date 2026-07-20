import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/ast/analysis.ts";
import { llmOutputToShell } from "../../src/rules/llmOutputToShell.ts";

const read = (name: string) =>
  readFileSync(join(__dirname, "fixtures", "llm-shell", name), "utf8");

function findings(name: string) {
  const content = read(name);
  const analysis = analyzeProject([{ path: name, content }]);
  return llmOutputToShell.run({
    filePath: name,
    content,
    isGitTracked: false,
    analysis,
  });
}

describe("llmOutputToShell", () => {
  it("reports a Vercel output reaching a child-process shell sink", () => {
    const found = findings("fail-shell.ts");

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      ruleId: "llm-output-to-shell",
      tier: "check",
      confidence: "high",
      source: "Vercel AI SDK generateText().text",
      sink: "child_process.exec",
    });
    expect(found[0].message).toMatch(/source line \d+.*sink line \d+/);
    expect(found[0].fix).toContain("execFile");
  });

  it("reports OpenAI output reaching eval with an evaluator-specific fix", () => {
    const found = findings("fail-eval.ts");

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      ruleId: "llm-output-to-shell",
      tier: "check",
      confidence: "high",
      source: "OpenAI Responses output_text",
      sink: "global eval",
    });
    expect(found[0].message).toMatch(/source line \d+.*sink line \d+/);
    expect(found[0].fix).toContain("Parse and validate");
    expect(found[0].fix).not.toContain("execFile");
  });

  it("classifies a shell-spawning spawn(..., { shell: true }) sink as shell execution, not eval", () => {
    const found = findings("fail-spawn-shell.ts");

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      ruleId: "llm-output-to-shell",
      tier: "check",
      title: "LLM output reaches shell execution",
      confidence: "high",
      source: "Vercel AI SDK generateText().text",
      sink: "child_process.spawn (shell: true)",
    });
    expect(found[0].message).toMatch(/source line \d+.*sink line \d+/);
    expect(found[0].fix).toContain("execFile");
    expect(found[0].fix).not.toContain("Parse and validate");
  });

  it("returns no findings without shared analysis or for safe APIs", () => {
    expect(llmOutputToShell.run({
      filePath: "pass.ts",
      content: read("pass.ts"),
      isGitTracked: false,
    })).toEqual([]);
    expect(findings("pass.ts")).toEqual([]);
  });
});
