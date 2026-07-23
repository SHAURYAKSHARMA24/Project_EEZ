import { describe, expect, it } from "vitest";
import { runRules } from "../src/engine.ts";
import { renderJson } from "../src/report/json.ts";
import type { Finding, Rule, RuleContext } from "../src/types.ts";

function findingRule(id: string, line = 2): Rule {
  return {
    id,
    tier: "check",
    appliesTo: () => true,
    run: (ctx: RuleContext): Finding[] => [{
      ruleId: id,
      tier: "check",
      title: "Test finding",
      file: ctx.filePath,
      line,
      confidence: "high",
      message: "Test message",
      fix: "Test fix",
    }],
  };
}

describe("comment suppressions", () => {
  it("suppresses a named rule on the immediately following physical line", () => {
    const result = runRules([{
      path: "fixture.ts",
      content: "// eez-ignore-next-line test-rule -- intentional fixture\nconst value = 1;",
      isGitTracked: false,
    }], [findingRule("test-rule")]);

    expect(result.findings).toEqual([]);
    expect(result.checkFailures).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.suppressed).toEqual([{
      ruleId: "test-rule",
      file: "fixture.ts",
      line: 2,
      directiveLine: 1,
      reason: "intentional fixture",
    }]);
  });

  it("supports multiple registered rule IDs in one directive", () => {
    const result = runRules([{
      path: "fixture.ts",
      content: "// eez-ignore-next-line first-rule,second-rule -- intentional fixture\nconst value = 1;",
      isGitTracked: false,
    }], [findingRule("first-rule"), findingRule("second-rule")]);

    expect(result.findings).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.suppressed.map((suppression) => suppression.ruleId)).toEqual([
      "first-rule",
      "second-rule",
    ]);
  });

  it("removes only the rule IDs named by a directive", () => {
    const result = runRules([{
      path: "fixture.ts",
      content: "// eez-ignore-next-line first-rule -- intentional fixture\nconst value = 1;",
      isGitTracked: false,
    }], [findingRule("first-rule"), findingRule("second-rule")]);

    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["second-rule"]);
    expect(result.suppressed.map((suppression) => suppression.ruleId)).toEqual(["first-rule"]);
    expect(result.errors).toEqual([]);
  });

  it("does not reach past the next physical line", () => {
    const result = runRules([{
      path: "fixture.ts",
      content: "// eez-ignore-next-line test-rule -- intentional fixture\n\nconst value = 1;",
      isGitTracked: false,
    }], [findingRule("test-rule", 3)]);

    expect(result.findings).toHaveLength(1);
    expect(result.suppressed).toEqual([]);
    expect(result.errors).toEqual([{
      ruleId: "suppression",
      file: "fixture.ts",
      message: "Stale EEZ suppression at line 1.",
    }]);
  });

  it.each([
    "// eez-ignore-next-line test-rule",
    "// eez-ignore-next-line test-rule --    ",
    "// eez-ignore-next-line test-rule,test-rule -- intentional fixture",
  ])("reports malformed directives safely", (directive) => {
    const result = runRules([{
      path: "fixture.ts",
      content: `${directive}\nconst value = 1;`,
      isGitTracked: false,
    }], [findingRule("test-rule")]);

    expect(result.findings).toHaveLength(1);
    expect(result.suppressed).toEqual([]);
    expect(result.errors).toEqual([{
      ruleId: "suppression",
      file: "fixture.ts",
      message: "Malformed EEZ suppression directive at line 1.",
    }]);
  });

  it("reports unknown and stale directives without echoing their text", () => {
    const unknown = runRules([{
      path: "fixture.ts",
      content: "// eez-ignore-next-line not-a-rule -- intentional fixture\nconst value = 1;",
      isGitTracked: false,
    }], [findingRule("test-rule")]);
    const stale = runRules([{
      path: "fixture.ts",
      content: "// eez-ignore-next-line test-rule -- intentional fixture\nconst value = 1;",
      isGitTracked: false,
    }], [findingRule("test-rule", 3)]);

    expect(unknown.errors[0]?.message).toBe("Unknown EEZ suppression rule at line 1.");
    expect(stale.errors[0]?.message).toBe("Stale EEZ suppression at line 1.");
    expect(JSON.stringify(unknown.errors)).not.toContain("not-a-rule");
  });

  it("does not interpret .env directives as suppressions", () => {
    const result = runRules([{
      path: ".env",
      content: "// eez-ignore-next-line test-rule -- intentional fixture\nVALUE=value",
      isGitTracked: true,
    }], [findingRule("test-rule")]);

    expect(result.findings).toHaveLength(1);
    expect(result.suppressed).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("does not interpret directives in .env TypeScript variants as suppressions", () => {
    const result = runRules([{
      path: ".env.ts",
      content: "// eez-ignore-next-line test-rule -- intentional fixture\nconst value = 1;",
      isGitTracked: true,
    }], [findingRule("test-rule")]);

    expect(result.findings).toHaveLength(1);
    expect(result.suppressed).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("redacts known secrets from suppression metadata and JSON", () => {
    const rawSecret = ["sk-", "ABCDEFGHIJKLMNOP1234567890"].join("");
    const result = runRules([{
      path: `fixtures/${rawSecret}/fixture.ts`,
      content:
        "// eez-ignore-next-line test-rule -- " + rawSecret + " fixture\nconst value = 1;",
      isGitTracked: false,
    }], [findingRule("test-rule")]);

    const output = renderJson(result.findings, result.errors, result.suppressed);
    expect(JSON.stringify(result.suppressed)).not.toContain(rawSecret);
    expect(output).not.toContain(rawSecret);
    expect(result.suppressed[0]?.reason).toContain("sk-\u20267890");
  });
});
