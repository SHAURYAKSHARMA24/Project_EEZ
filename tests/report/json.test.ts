import { describe, it, expect } from "vitest";
import { renderJson } from "../../src/report/json.ts";
import { JSON_SCHEMA_VERSION } from "../../src/report/jsonSchema.ts";
import type { Finding, RuleError, Suppression } from "../../src/types.ts";

const f: Finding = { ruleId: "r", tier: "check", title: "t", file: "a.ts",
  line: 3, confidence: "high", message: "m", fix: "fix it" };

describe("renderJson", () => {
  it("emits findings and a tier summary", () => {
    const parsed = JSON.parse(renderJson([f]));
    expect(parsed.schemaVersion).toBe(JSON_SCHEMA_VERSION);
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.summary).toEqual({ check: 1, audit: 0, suppressed: 0, total: 1 });
    expect(parsed.errors).toEqual([]);
    expect(parsed.suppressed).toEqual([]);
  });

  it("counts audit findings and preserves diagnostics separately", () => {
    const audit: Finding = { ...f, ruleId: "audit", tier: "audit" };
    const error: RuleError = { ruleId: "scanner", file: ".", message: "Unable to complete the scan." };
    const parsed = JSON.parse(renderJson([f, audit], [error]));
    expect(parsed.summary).toEqual({ check: 1, audit: 1, suppressed: 0, total: 2 });
    expect(parsed.errors).toEqual([error]);
  });

  it("renders an empty result without manufacturing findings", () => {
    const parsed = JSON.parse(renderJson([]));
    expect(parsed).toEqual({
      schemaVersion: 1,
      scanComplete: true,
      findings: [],
      errors: [],
      suppressed: [],
      summary: { check: 0, audit: 0, suppressed: 0, total: 0 },
    });
  });

  it("marks scanComplete false when the scan could not fully complete", () => {
    const error: RuleError = { ruleId: "scanner", file: ".", message: "Unable to complete the scan." };
    const parsed = JSON.parse(renderJson([], [error], [], false));
    expect(parsed.scanComplete).toBe(false);
  });

  it("includes structured, redacted suppressions in the summary", () => {
    // eez-ignore-next-line hardcoded-credential -- intentional redaction test fixture
    const rawSecret = "sk-ABCDEFGHIJKLMNOP1234567890";
    const suppression: Suppression = {
      ruleId: "r",
      file: `a-${rawSecret}.ts`,
      line: 2,
      directiveLine: 1,
      reason: `fixture ${rawSecret}`,
    };

    const output = renderJson([], [], [suppression]);
    const parsed = JSON.parse(output);
    expect(parsed.suppressed).toEqual([{
      ruleId: "r",
      file: "a-sk-\u20267890.ts",
      line: 2,
      directiveLine: 1,
      reason: "fixture sk-\u20267890",
    }]);
    expect(parsed.summary.suppressed).toBe(1);
    expect(output).not.toContain(rawSecret);
  });
});
