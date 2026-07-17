import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { secretToBrowser } from "../../src/rules/secretToBrowser.ts";

const read = (name: string) =>
  readFileSync(join(__dirname, "fixtures/browser", name), "utf8");

describe("secretToBrowser", () => {
  it("flags known secrets co-located with a client-exposed prefix", () => {
    const findings = secretToBrowser.run({
      filePath: "fail.ts",
      content: read("fail.ts"),
      isGitTracked: false,
    });
    expect(findings.length).toBe(2);
    expect(findings[0].ruleId).toBe("secret-to-browser");
    expect(findings[0].tier).toBe("check");
    expect(findings[0].fix.toLowerCase()).toContain("server");
    expect(findings[0].line).toBe(2);
    expect(findings[1].line).toBe(4);
    expect(findings[1].message).toMatch(/^An OpenAI API key/);
    for (const f of findings) {
      expect(f.masked).toBe(true);
      expect(f.message).not.toContain("ABCDEFGHIJKLMNOP");
    }
  });

  it("does not flag public non-secrets or non-prefixed secrets", () => {
    const findings = secretToBrowser.run({
      filePath: "pass.ts",
      content: read("pass.ts"),
      isGitTracked: false,
    });
    expect(findings).toHaveLength(0);
  });
});
