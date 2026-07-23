import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../../src/cli.ts";

const testRoot = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(testRoot, "fixtures");
const positivePath = join(testRoot, "..", "corpus", "positives", "openai-exec.ts");
const directive = /^.*eez-ignore-next-line llm-output-to-shell -- intentional positive M1a fixture\r?\n/m;
let root: string;

function git(...args: string[]): void {
  execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
}

function activePositive(): string {
  const content = readFileSync(positivePath, "utf8");
  const active = content.replace(directive, "");
  if (active === content) throw new Error("Expected the positive fixture suppression.");
  return active;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "eez-workflow-"));
  execFileSync("git", ["init", "-q", root]);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("M1 productization workflow", () => {
  it("reports an active staged M1a finding through JSON v1", () => {
    writeFileSync(join(root, "vulnerable.ts"), activePositive());
    git("add", "vulnerable.ts");

    const result = run(["check", "--staged", "--format", "json"], root);
    const report = JSON.parse(result.output);
    expect(result.code).toBe(1);
    expect(report.schemaVersion).toBe(1);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].ruleId).toBe("llm-output-to-shell");
  });

  it("ignores a vulnerable unstaged edit when the staged blob is safe", () => {
    const path = join(root, "partial.ts");
    writeFileSync(path, readFileSync(join(fixtureRoot, "staged-safe.ts"), "utf8"));
    git("add", "partial.ts");
    writeFileSync(path, activePositive());

    const result = run(["check", "--staged", "--format", "json"], root);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.output).findings).toEqual([]);
  });

  it("honours an exact suppression in the staged blob", () => {
    writeFileSync(
      join(root, "suppressed.ts"),
      readFileSync(join(fixtureRoot, "staged-suppressed.ts"), "utf8"),
    );
    git("add", "suppressed.ts");

    const result = run(["check", "--staged", "--format", "json"], root);
    const report = JSON.parse(result.output);
    expect(result.code).toBe(0);
    expect(report.findings).toEqual([]);
    expect(report.errors).toEqual([]);
    expect(report.summary.suppressed).toBe(1);
  });

  it("emits GitHub annotations and an HTML sidecar from the same staged input", () => {
    writeFileSync(join(root, "vulnerable.ts"), activePositive());
    git("add", "vulnerable.ts");
    const reportPath = join(root, "report.html");

    const github = run([
      "check",
      "--staged",
      "--format",
      "github",
      "--report",
      "html",
      "--output",
      reportPath,
    ], root);
    expect(github.code).toBe(1);
    expect(github.output).toContain("::error file=vulnerable.ts");
    expect(existsSync(reportPath)).toBe(true);
    expect(readFileSync(reportPath, "utf8")).toContain("llm-output-to-shell");
  });
});
