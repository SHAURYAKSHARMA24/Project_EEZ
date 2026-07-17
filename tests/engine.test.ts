import { describe, it, expect } from "vitest";
import { runRules } from "../src/engine.ts";
import { renderJson } from "../src/report/json.ts";
import { renderSober } from "../src/report/sober.ts";
import type { Rule, Finding } from "../src/types.ts";

const alwaysFires: Rule = {
  id: "always",
  tier: "check",
  appliesTo: (p) => p.endsWith(".ts"),
  run: (ctx): Finding[] => [
    { ruleId: "always", tier: "check", title: "t", file: ctx.filePath,
      line: 1, confidence: "high", message: "m", fix: "f" },
  ],
};

describe("runRules", () => {
  it("runs applicable rules and separates check failures", () => {
    const res = runRules(
      [
        { path: "a.ts", content: "x", isGitTracked: false },
        { path: "b.md", content: "y", isGitTracked: false },
      ],
      [alwaysFires],
    );
    expect(res.findings).toHaveLength(1);
    expect(res.findings[0].file).toBe("a.ts");
    expect(res.checkFailures).toHaveLength(1);
  });

  it("keeps audit findings out of checkFailures", () => {
    const auditRule: Rule = { ...alwaysFires, id: "aud", tier: "audit",
      run: (ctx) => [{ ruleId: "aud", tier: "audit", title: "t", file: ctx.filePath,
        line: 1, confidence: "low", message: "m", fix: "f" }] };
    const res = runRules([{ path: "a.ts", content: "x", isGitTracked: false }], [auditRule]);
    expect(res.findings).toHaveLength(1);
    expect(res.checkFailures).toHaveLength(0);
  });

  it("isolates rule failures without exposing their thrown content", () => {
    // preflight-ignore-next-line hardcoded-credential -- intentional test fixture
    const rawSecret = "sk-ABCDEFGHIJKLMNOP1234567890";
    const throwingApplies: Rule = {
      id: "throws-applies",
      tier: "check",
      appliesTo: () => {
        throw new Error(rawSecret);
      },
      run: () => [],
    };
    const throwingRun: Rule = {
      id: "throws-run",
      tier: "check",
      appliesTo: () => true,
      run: () => {
        throw new Error(rawSecret);
      },
    };

    const res = runRules(
      [{ path: "a.ts", content: "x", isGitTracked: false }],
      [throwingApplies, throwingRun, alwaysFires],
    );

    expect(res.findings).toHaveLength(1);
    expect(res.errors).toEqual([
      { ruleId: "throws-applies", file: "a.ts", message: "Rule could not scan this file." },
      { ruleId: "throws-run", file: "a.ts", message: "Rule could not scan this file." },
    ]);
    expect(JSON.stringify(res)).not.toContain(rawSecret);
  });

  it("strips unexpected rule-result fields before reporting", () => {
    // preflight-ignore-next-line hardcoded-credential -- intentional test fixture
    const rawSecret = "sk-ABCDEFGHIJKLMNOP1234567890";
    const unsafeRule: Rule = {
      id: "unsafe",
      tier: "check",
      appliesTo: () => true,
      run: (ctx) => [{
        ruleId: "unsafe",
        tier: "check",
        title: rawSecret,
        file: `${ctx.filePath}/${rawSecret}`,
        line: 1,
        confidence: "high",
        message: rawSecret,
        fix: rawSecret,
        source: rawSecret,
        sink: rawSecret,
        evidence: rawSecret,
      } as Finding],
    };

    const res = runRules([{ path: "a.ts", content: "x", isGitTracked: false }], [unsafeRule]);
    expect(JSON.stringify(res.findings)).not.toContain(rawSecret);
    expect(renderJson(res.findings, res.errors)).not.toContain(rawSecret);
    expect(renderSober(res.findings, res.errors)).not.toContain(rawSecret);
  });
});
