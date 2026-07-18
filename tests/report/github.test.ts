import { describe, expect, it } from "vitest";
import { renderGithub } from "../../src/report/github.ts";
import type { Finding, RuleError, Suppression } from "../../src/types.ts";

const finding: Finding = {
  ruleId: "llm-output-to-shell",
  tier: "check",
  title: "LLM output reaches shell execution",
  file: "src/app.ts",
  line: 7,
  column: 3,
  confidence: "high",
  message: "Model output reaches exec.",
  fix: "Use execFile.",
};

describe("renderGithub", () => {
  it("maps check, audit, and diagnostics to native annotations", () => {
    const audit: Finding = { ...finding, tier: "audit", ruleId: "review", file: "src/review.ts" };
    const error: RuleError = { ruleId: "scanner", file: ".", message: "Scan failed." };
    const suppression: Suppression = {
      ruleId: "llm-output-to-shell",
      file: "fixture.ts",
      line: 2,
      directiveLine: 1,
      reason: "fixture",
    };
    const output = renderGithub([finding, audit], [error], [suppression]);

    expect(output).toContain("::error file=src/app.ts,line=7,col=3,title=preflight/llm-output-to-shell::");
    expect(output).toContain("::warning file=src/review.ts,line=7,col=3,title=preflight/review::");
    expect(output).toContain("::error file=.,title=preflight/scanner::Scan failed.");
    expect(output).toContain("1 check, 1 audit (2 total), 1 suppression(s), 1 diagnostic(s)");
    expect(output).not.toContain("reason=fixture");
  });

  it("escapes command injection characters and redacts known secrets", () => {
    // preflight-ignore-next-line hardcoded-credential -- intentional redaction fixture
    const rawSecret = "sk-ABCDEFGHIJKLMNOP1234567890";
    const hostile: Finding = {
      ...finding,
      ruleId: "rule:one,two%",
      file: "src/a:b,c%.ts",
      title: `line one\nline two ${rawSecret}`,
      message: "message%\r\nnext",
      fix: "fix%\nnow",
    };
    const output = renderGithub([hostile]);

    expect(output).toContain("file=src/a%3Ab%2Cc%25.ts");
    expect(output).toContain("title=preflight/rule%3Aone%2Ctwo%25");
    expect(output).toContain("message%25%0D%0Anext");
    expect(output).toContain("fix%25%0Anow");
    expect(output).not.toContain(rawSecret);
    expect(output).not.toContain("\r");
  });

  it("renders a clean summary without annotations", () => {
    const output = renderGithub([]);
    expect(output).toBe("0 check, 0 audit (0 total)");
    expect(output).not.toContain("::");
  });
});
