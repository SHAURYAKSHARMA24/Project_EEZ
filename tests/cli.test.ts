import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/cli.ts";

let root: string;
let tempRoots: string[];

function makeTemp(prefix: string): string {
  const path = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(path);
  return path;
}

beforeEach(() => {
  tempRoots = [];
  root = makeTemp("preflight-cli-");
  // preflight-ignore-next-line hardcoded-credential -- intentional test fixture
  writeFileSync(join(root, "bad.ts"), 'const k = "sk-ABCDEFGHIJKLMNOP1234567890";');
});
afterEach(() => {
  for (const path of tempRoots.reverse()) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe("run", () => {
  it("detects OpenAI Responses output reaching exec through the real CLI path", () => {
    const fixture = makeTemp("preflight-openai-shell-");
    writeFileSync(join(fixture, "vulnerable.ts"), `
import OpenAI from "openai";
import { exec } from "node:child_process";
async function vulnerable() {
  const client = new OpenAI();
  const response = await client.responses.create({ input: "command" });
  exec(response.output_text);
}
`);

    const result = run(["check", fixture, "--json"], fixture);
    const payload = JSON.parse(result.output);
    expect(result.code).toBe(1);
    expect(payload.findings).toHaveLength(1);
    expect(payload.findings[0]).toMatchObject({
      ruleId: "llm-output-to-shell",
      source: "OpenAI Responses output_text",
    });
  });

  it("detects Vercel generateText output reaching exec through the real CLI path", () => {
    const fixture = makeTemp("preflight-vercel-shell-");
    writeFileSync(join(fixture, "vulnerable.ts"), `
import { generateText } from "ai";
import { exec } from "node:child_process";
async function vulnerable() {
  const result = await generateText({ prompt: "command" });
  exec(result.text);
}
`);

    const result = run(["check", fixture, "--json"], fixture);
    const payload = JSON.parse(result.output);
    expect(result.code).toBe(1);
    expect(payload.findings).toHaveLength(1);
    expect(payload.findings[0]).toMatchObject({
      ruleId: "llm-output-to-shell",
      source: "Vercel AI SDK generateText().text",
    });
  });

  it("check exits 1 and reports the finding", () => {
    const res = run(["check"], root);
    expect(res.code).toBe(1);
    expect(res.output).toContain("bad.ts:1");
  });

  it("check exits 0 on a clean dir", () => {
    const clean = makeTemp("preflight-clean-");
    writeFileSync(join(clean, "ok.ts"), "export const x = 1;");
    const res = run(["check"], clean);
    expect(res.code).toBe(0);
  });

  it("audit exits 0 for findings", () => {
    const res = run(["audit", "--json"], root);
    const payload = JSON.parse(res.output);
    expect(res.code).toBe(0);
    expect(payload.scanComplete).toBe(true);
    expect(payload.summary.total).toBeGreaterThan(0);
  });

  it("audit exits 2 when a scan cannot complete", () => {
    const res = run(["audit", join(root, "missing"), "--json"], root);
    const payload = JSON.parse(res.output);
    expect(res.code).toBe(2);
    expect(payload.scanComplete).toBe(false);
    expect(payload.errors).toEqual([
      { ruleId: "scanner", file: ".", message: "Unable to complete the scan." },
    ]);
  });

  it("check mode exit codes and scanComplete are unaffected by the audit contract", () => {
    const clean = run(["check", "--json"], root);
    const cleanPayload = JSON.parse(clean.output);
    expect(clean.code).toBe(1);
    expect(cleanPayload.scanComplete).toBe(true);

    const missing = run(["check", join(root, "missing"), "--json"], root);
    const missingPayload = JSON.parse(missing.output);
    expect(missing.code).toBe(2);
    expect(missingPayload.scanComplete).toBe(false);
  });

  it("--json emits parseable output", () => {
    const res = run(["check", "--json"], root);
    expect(JSON.parse(res.output).summary.check).toBe(1);
  });

  it("supports explicit JSON and GitHub output formats", () => {
    const alias = run(["check", "--json"], root);
    const explicit = run(["check", "--format", "json"], root);
    const github = run(["check", "--format", "github"], root);

    expect(explicit).toEqual(alias);
    expect(JSON.parse(explicit.output).schemaVersion).toBe(1);
    expect(github.code).toBe(1);
    expect(github.output).toContain("::error file=bad.ts,line=1,title=preflight/hardcoded-credential::");
  });

  it("rejects invalid or conflicting output formats regardless of command", () => {
    expect(run(["check", "--format", "sarif"], root).code).toBe(2);
    expect(run(["audit", "--format", "sarif"], root).code).toBe(2);
    expect(run(["check", "--json", "--format", "github"], root).code).toBe(2);
  });

  it("writes a self-contained HTML sidecar without changing stdout or exit status", () => {
    const reportPath = join(root, "preflight-report.html");
    const result = run([
      "check",
      "--format",
      "json",
      "--report",
      "html",
      "--output",
      reportPath,
    ], root);
    const html = readFileSync(reportPath, "utf8");

    expect(result.code).toBe(1);
    expect(JSON.parse(result.output).summary.check).toBe(1);
    expect(html).toContain("Preflight security report");
    expect(html).toContain("Hardcoded OpenAI API key");
    expect(html).not.toContain("ABCDEFGHIJKLMNOP1234567890");
    expect(html).not.toMatch(/<(?:script|link|img)\b/i);
  });

  it("validates HTML report flags and safely reports write failures", () => {
    expect(run(["check", "--report", "html"], root).code).toBe(2);
    expect(run(["check", "--output", "report.html"], root).code).toBe(2);
    expect(run(["check", "--report", "pdf", "--output", "report.pdf"], root).code).toBe(2);
    expect(run(["audit", "--report", "html"], root).code).toBe(2);

    const failed = run([
      "check",
      "--format",
      "json",
      "--report",
      "html",
      "--output",
      join(root, "missing", "report.html"),
    ], root);
    expect(failed.code).toBe(2);
    const failedPayload = JSON.parse(failed.output);
    expect(failedPayload.scanComplete).toBe(false);
    expect(failedPayload.errors).toEqual([
      { ruleId: "scanner", file: ".", message: "Unable to complete the scan." },
    ]);

    const auditFailed = run([
      "audit",
      "--format",
      "json",
      "--report",
      "html",
      "--output",
      join(root, "missing", "report.html"),
    ], root);
    expect(auditFailed.code).toBe(2);
    const auditFailedPayload = JSON.parse(auditFailed.output);
    expect(auditFailedPayload.scanComplete).toBe(false);
    expect(auditFailedPayload.errors).toEqual([
      { ruleId: "scanner", file: ".", message: "Unable to complete the scan." },
    ]);
  });

  it("applies named comment suppressions and reports them without reasons", () => {
    const clean = makeTemp("preflight-suppressed-");
    const rawSecret = ["sk-", "ABCDEFGHIJKLMNOP1234567890"].join("");
    writeFileSync(
      join(clean, "browser.ts"),
      `// preflight-ignore-next-line hardcoded-credential,secret-to-browser -- intentional browser fixture\n` +
      `export const config = { NEXT_PUBLIC_KEY: "${rawSecret}" };\n`,
    );
    writeFileSync(
      join(clean, "server.ts"),
      `// preflight-ignore-next-line hardcoded-credential -- intentional server fixture\n` +
      `export const key = "${rawSecret}";\n`,
    );

    const json = run(["check", "--json"], clean);
    const parsed = JSON.parse(json.output);
    expect(json.code).toBe(0);
    expect(parsed.findings).toEqual([]);
    expect(parsed.errors).toEqual([]);
    expect(parsed.summary).toMatchObject({ check: 0, total: 0, suppressed: 3 });
    expect(parsed.suppressed.map((suppression: { ruleId: string }) => suppression.ruleId).sort()).toEqual([
      "hardcoded-credential",
      "hardcoded-credential",
      "secret-to-browser",
    ]);

    const sober = run(["check"], clean);
    expect(sober.code).toBe(0);
    expect(sober.output).toContain("3 suppression(s)");
    expect(sober.output).not.toContain("intentional browser fixture");
    expect(sober.output).not.toContain("intentional server fixture");
  });

  it("makes malformed, unknown, and stale suppressions safe CLI diagnostics", () => {
    const rawSecret = ["sk-", "ABCDEFGHIJKLMNOP1234567890"].join("");
    const cases = [
      {
        directive: "// preflight-ignore-next-line hardcoded-credential --    ",
        target: `const key = "${rawSecret}";`,
        message: "Malformed preflight suppression directive at line 1.",
      },
      {
        directive: "// preflight-ignore-next-line not-a-rule -- intentional fixture",
        target: `const key = "${rawSecret}";`,
        message: "Unknown preflight suppression rule at line 1.",
      },
      {
        directive: "// preflight-ignore-next-line hardcoded-credential -- intentional fixture",
        target: "export const value = 1;",
        message: "Stale preflight suppression at line 1.",
      },
    ];

    for (const testCase of cases) {
      const fixture = makeTemp("preflight-diagnostic-");
      writeFileSync(join(fixture, "fixture.ts"), `${testCase.directive}\n${testCase.target}\n`);

      const check = run(["check", "--json"], fixture);
      const checkPayload = JSON.parse(check.output);
      expect(check.code).toBe(2);
      expect(checkPayload.scanComplete).toBe(false);
      expect(checkPayload.errors).toEqual([
        { ruleId: "suppression", file: "fixture.ts", message: testCase.message },
      ]);
      expect(check.output).not.toContain(rawSecret);

      const audit = run(["audit", "--json"], fixture);
      const auditPayload = JSON.parse(audit.output);
      expect(audit.code).toBe(2);
      expect(auditPayload.scanComplete).toBe(false);
      expect(auditPayload.errors).toEqual(checkPayload.errors);
      expect(audit.output).not.toContain(rawSecret);
    }
  });

  it("shows help without scanning", () => {
    const long = run(["--help"], root);
    const short = run(["-h"], root);
    expect(long).toEqual({ code: 0, output: expect.stringContaining("Usage: preflight") });
    expect(short).toEqual(long);
  });

  it("shows the installed version without scanning", () => {
    expect(run(["--version"], root)).toEqual({ code: 0, output: "0.1.0" });
    expect(run(["-v"], root)).toEqual({ code: 0, output: "0.1.0" });
  });

  it("rejects combined help and version flags", () => {
    expect(run(["--help", "--version"], root)).toEqual({
      code: 2,
      output: "Usage: preflight <check|audit> [path] [--staged] [--json | --format sober|json|github] [--report html --output <file>]",
    });
  });

  it("treats a directory as an implicit check root relative to the supplied cwd", () => {
    const syntheticCwd = makeTemp("preflight-cwd-");
    const target = join(syntheticCwd, "target");
    mkdirSync(target);
    // preflight-ignore-next-line hardcoded-credential -- intentional test fixture
    writeFileSync(join(target, "bad.ts"), 'const k = "sk-ABCDEFGHIJKLMNOP1234567890";');

    const res = run(["./target"], syntheticCwd);
    expect(res.code).toBe(1);
    expect(res.output).toContain("bad.ts:1");
  });

  it("returns a usage error for an unknown command", () => {
    const res = run(["frobnicate"], root);
    expect(res).toEqual({
      code: 2,
      output: "Unknown command \"frobnicate\". Usage: preflight <check|audit> [path] [--staged] [--json | --format sober|json|github] [--report html --output <file>]",
    });
  });

  it("redacts a secret-shaped unknown command", () => {
    // preflight-ignore-next-line hardcoded-credential -- intentional test fixture
    const rawSecret = "sk-ABCDEFGHIJKLMNOP1234567890";
    const res = run([rawSecret], root);
    expect(res.code).toBe(2);
    expect(res.output).not.toContain(rawSecret);
    expect(res.output).toContain("sk-\u20267890");
  });

  it("returns a diagnostic and code 2 when check cannot scan a root", () => {
    const res = run(["check", join(root, "missing"), "--json"], root);
    const parsed = JSON.parse(res.output);
    expect(res.code).toBe(2);
    expect(parsed.scanComplete).toBe(false);
    expect(parsed.findings).toEqual([]);
    expect(parsed.errors).toEqual([
      { ruleId: "scanner", file: ".", message: "Unable to complete the scan." },
    ]);
  });

  it("returns exit 2 for audit when setup or argument parsing fails", () => {
    const missing = run(["audit", join(root, "missing")], root);
    expect(missing.code).toBe(2);
    expect(missing.output).not.toContain("No findings");

    const malformed = run(["--json", "audit", "--bad-flag"], root);
    expect(malformed.code).toBe(2);
    expect(malformed.output).not.toContain("No findings");

    const tooManyPositionals = run(["audit", root, "extra"], root);
    expect(tooManyPositionals.code).toBe(2);
    expect(tooManyPositionals.output).toContain("Usage: preflight");
  });

  it("blocks tracked .env secrets but not ignored local values", () => {
    const repo = makeTemp("preflight-env-");
    execFileSync("git", ["init", "-q", repo]);
    writeFileSync(join(repo, ".gitignore"), ".env\n");
    // preflight-ignore-next-line hardcoded-credential -- intentional test fixture
    writeFileSync(join(repo, ".env"), "SERVER_KEY=sk-ABCDEFGHIJKLMNOP1234567890\n");

    expect(run(["check"], repo).code).toBe(0);

    // preflight-ignore-next-line hardcoded-credential,secret-to-browser -- intentional test fixture
    writeFileSync(join(repo, ".env"), "NEXT_PUBLIC_KEY=sk-ABCDEFGHIJKLMNOP1234567890\n");
    const exposed = run(["check"], repo);
    expect(exposed.code).toBe(1);
    expect(exposed.output).toContain("exposed to the browser");

    const trackedSecret = ["sk-", "ABCDEFGHIJKLMNOP1234567890"].join("");
    writeFileSync(
      join(repo, ".env"),
      "// preflight-ignore-next-line hardcoded-credential -- intentional fixture\n" +
      `SERVER_KEY=${trackedSecret}\n`,
    );
    execFileSync("git", ["-C", repo, "add", "-f", ".env"]);
    const tracked = run(["check"], repo);
    expect(tracked.code).toBe(1);
    expect(tracked.output).toContain("Hardcoded OpenAI API key");
    expect(tracked.output).not.toContain("suppression");
  });

  it("keeps Git tracking correct when scanning a nested directory", () => {
    const repo = makeTemp("preflight-nested-");
    const nested = join(repo, "packages", "app");
    execFileSync("git", ["init", "-q", repo]);
    mkdirSync(nested, { recursive: true });
    // preflight-ignore-next-line hardcoded-credential -- intentional test fixture
    writeFileSync(join(nested, ".env"), "SERVER_KEY=sk-ABCDEFGHIJKLMNOP1234567890\n");
    execFileSync("git", ["-C", repo, "add", "-f", "packages/app/.env"]);

    const res = run(["check", nested], repo);
    expect(res.code).toBe(1);
    expect(res.output).toContain(".env:1");
  });
});

describe("audit exit semantics are order-independent", () => {
  // audit must exit 2 for operational/diagnostic failures, whether value-taking
  // flags precede or follow the command, whether the value is space- or
  // `=`-separated, and whether the failure is an invalid value, an unknown
  // flag, or a setup mismatch. Audit only stays at exit 0 for findings.
  const auditDiagnostics: [string, string[]][] = [
    ["invalid --format value before audit", ["--format", "sarif", "audit"]],
    ["invalid --format=value before audit", ["--format=sarif", "audit"]],
    ["valid --format value then unknown flag", ["--format", "json", "audit", "--bad-flag"]],
    ["valid --format value after audit then unknown flag", ["audit", "--format", "json", "--bad-flag"]],
    ["unknown flag before audit", ["--bad-flag", "audit"]],
    ["unknown flag after audit", ["audit", "--bad-flag"]],
    ["--report value before audit without --output", ["--report", "html", "audit"]],
    ["--output value before audit without --report", ["--output", "out.html", "audit"]],
    ["--report=value before audit without --output", ["--report=html", "audit"]],
  ];
  it.each(auditDiagnostics)("exits 2 for audit with %s", (_label, argv) => {
    expect(run(argv, root).code).toBe(2);
  });

  // The equivalent check invocations must still surface the diagnostic as exit 2.
  const checkTwo: [string, string[]][] = [
    ["invalid --format value before check", ["--format", "sarif", "check"]],
    ["invalid --format value after check", ["check", "--format", "sarif"]],
    ["valid --format value then unknown flag", ["--format", "json", "check", "--bad-flag"]],
    ["unknown flag before default check", ["--bad-flag"]],
    ["unknown flag after check", ["check", "--bad-flag"]],
    ["--report value before check without --output", ["--report", "html", "check"]],
  ];
  it.each(checkTwo)("exits 2 for check with %s", (_label, argv) => {
    expect(run(argv, root).code).toBe(2);
  });

  // A value that merely spells "audit" belongs to its option and is not the
  // command, so these remain checks and exit 2 on the invalid format value.
  const valueSpelledAudit: [string, string[]][] = [
    ["--format audit (bare)", ["--format", "audit"]],
    ["--format audit then a path positional", ["--format", "audit", "check"]],
    ["--format=audit (bare)", ["--format=audit"]],
  ];
  it.each(valueSpelledAudit)("treats an option value of 'audit' as a value, not the command (%s)", (_label, argv) => {
    expect(run(argv, root).code).toBe(2);
  });
});
