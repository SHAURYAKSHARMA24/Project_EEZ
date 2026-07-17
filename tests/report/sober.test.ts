import { describe, it, expect } from "vitest";
import { renderSober } from "../../src/report/sober.ts";
import type { Finding, RuleError, Suppression } from "../../src/types.ts";

const f: Finding = { ruleId: "r", tier: "check", title: "Hardcoded key", file: "a.ts",
  line: 3, confidence: "high", message: "A key is hardcoded.", fix: "Rotate it." };

describe("renderSober", () => {
  it("renders location, message, fix and a summary", () => {
    const out = renderSober([f]);
    expect(out).toContain("a.ts:3");
    expect(out).toContain("Hardcoded key");
    expect(out).toContain("Rotate it.");
    expect(out).toContain("1 check");
  });

  it("reports a clean scan", () => {
    expect(renderSober([]).toLowerCase()).toContain("no findings");
  });

  it("separates multiple findings, marks audit findings, and keeps the summary distinct", () => {
    const audit: Finding = { ...f, tier: "audit", file: "b.ts", line: 4 };
    const out = renderSober([f, audit]);
    expect(out).toContain("\u2022 b.ts:4");
    expect(out).toContain("Rotate it.\n\n\u2022 b.ts:4");
    expect(out).toContain("Rotate it.\n\n1 check, 1 audit (2 total)");
  });

  it("renders diagnostics without calling an incomplete scan clean", () => {
    const error: RuleError = { ruleId: "scanner", file: ".", message: "Unable to complete the scan." };
    const out = renderSober([], [error]);
    expect(out).toContain("[diagnostic] scanner");
    expect(out).not.toContain("No findings");
  });

  it("reports a compact suppression count without echoing reasons", () => {
    const suppression: Suppression = {
      ruleId: "r",
      file: "a.ts",
      line: 2,
      directiveLine: 1,
      reason: "intentional fixture only",
    };
    const out = renderSober([], [], [suppression]);
    expect(out).toContain("1 suppression(s)");
    expect(out).not.toContain(suppression.reason);
  });
});
