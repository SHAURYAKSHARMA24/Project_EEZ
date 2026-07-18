import { describe, expect, it } from "vitest";
import { renderHtml } from "../../src/report/html.ts";
import type { Finding, RuleError, Suppression } from "../../src/types.ts";

const shellFinding: Finding = {
  ruleId: "llm-output-to-shell",
  tier: "check",
  title: "LLM output reaches shell execution",
  file: "src/app.ts",
  line: 12,
  confidence: "high",
  source: "Vercel AI SDK generateText().text",
  sink: "child_process.exec",
  message: "Model output can become executable code.",
  fix: "Use execFile with validated arguments.",
};

describe("renderHtml", () => {
  it("renders a polished grouped report with counts, diagnostics, and fixes", () => {
    const audit: Finding = {
      ...shellFinding,
      ruleId: "review-rule",
      tier: "audit",
      file: "src/review.ts",
      line: 4,
    };
    const error: RuleError = { ruleId: "scanner", file: ".", message: "Scan failed." };
    const suppression: Suppression = {
      ruleId: "llm-output-to-shell",
      file: "fixture.ts",
      line: 2,
      directiveLine: 1,
      reason: "private fixture reason",
    };
    const output = renderHtml([shellFinding, audit], [error], [suppression]);

    expect(output).toContain("<!doctype html>");
    expect(output).toContain("Preflight security report");
    expect(output).toContain("1 check");
    expect(output).toContain("1 audit");
    expect(output).toContain("1 diagnostic");
    expect(output).toContain("1 suppression");
    expect(output).toContain("llm-output-to-shell");
    expect(output).toContain("src/app.ts:12");
    expect(output).toContain("Vercel AI SDK generateText().text");
    expect(output).toContain("child_process.exec");
    expect(output).toContain("Use execFile with validated arguments.");
    expect(output).toContain("Scan failed.");
    expect(output).not.toContain(suppression.reason);
  });

  it("redacts secrets, escapes hostile values, and contains no external resources or scripts", () => {
    // preflight-ignore-next-line hardcoded-credential -- intentional redaction fixture
    const rawSecret = "sk-ABCDEFGHIJKLMNOP1234567890";
    const hostile: Finding = {
      ...shellFinding,
      file: "<script>alert(1)</script>.ts",
      title: `<img src=x onerror=alert(1)> ${rawSecret}`,
      message: "A & B < C",
      fix: "Use > safely",
    };
    const output = renderHtml([hostile]);

    expect(output).not.toContain(rawSecret);
    expect(output).not.toContain("<script>");
    expect(output).not.toContain("<img");
    expect(output).toContain("&lt;script&gt;");
    expect(output).toContain("A &amp; B &lt; C");
    expect(output).not.toMatch(/<(?:script|link|img)\b/i);
    expect(output).not.toMatch(/(?:src|href)=["']https?:/i);
  });

  it("is deterministic and renders a clean state", () => {
    const first = renderHtml([]);
    const second = renderHtml([]);
    expect(first).toBe(second);
    expect(first).toContain("No active findings");
    expect(first).toContain("0 check");
  });
});
