import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hardcodedCredential } from "../../src/rules/hardcodedCredential.ts";

const read = (name: string) =>
  readFileSync(join(__dirname, "fixtures/hardcoded", name), "utf8");

describe("hardcodedCredential", () => {
  it("flags known key formats and masks them", () => {
    const findings = hardcodedCredential.run({
      filePath: "fail.ts",
      content: read("fail.ts"),
      isGitTracked: false,
    });
    expect(findings.length).toBe(2);
    const f = findings[0];
    expect(f.ruleId).toBe("hardcoded-credential");
    expect(f.tier).toBe("check");
    for (const finding of findings) {
      expect(finding.masked).toBe(true);
      expect(finding.message).not.toContain("ABCDEFGHIJKLMNOP");
      expect(finding.message).not.toContain("1234567890ABCDEF");
    }
    expect(f.fix.toLowerCase()).toContain("rotate");
    expect(findings[0].message).toMatch(/^An OpenAI API key/);
    expect(findings[1].message).toMatch(/^An AWS access key id/);
  });

  it("does not flag env-var usage or prose", () => {
    const findings = hardcodedCredential.run({
      filePath: "pass.ts",
      content: read("pass.ts"),
      isGitTracked: false,
    });
    expect(findings).toHaveLength(0);
  });
});
