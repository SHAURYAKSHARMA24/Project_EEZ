import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builtCli = join(repoRoot, "dist", "cli.js");
const tempRoot = mkdtempSync(join(tmpdir(), "eez-self-scan-"));
const scanRoots = ["src", "tests"];

if (!existsSync(builtCli)) {
  throw new Error("dist/cli.js is missing. Run npm run build before the self-scan.");
}

try {
  const reports = scanRoots.map((root) => {
    const result = spawnSync(process.execPath, [builtCli, "check", root, "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.error || result.status !== 0) {
      throw new Error(`The built EEZ self-scan failed for ${root}.`);
    }

    let report;
    try {
      report = JSON.parse(result.stdout);
    } catch {
      throw new Error(`The built EEZ self-scan did not return valid JSON for ${root}.`);
    }
    if (
      report.schemaVersion !== 1
      || !Array.isArray(report.findings)
      || !Array.isArray(report.errors)
      || !Array.isArray(report.suppressed)
      || typeof report.summary?.check !== "number"
      || typeof report.summary?.audit !== "number"
      || typeof report.summary?.suppressed !== "number"
      || typeof report.summary?.total !== "number"
      || report.findings.length !== 0
      || report.errors.length !== 0
      || report.summary.check !== 0
      || report.summary.audit !== 0
      || report.summary.total !== 0
      || report.summary.suppressed !== report.suppressed.length
    ) {
      throw new Error(`The built EEZ self-scan did not produce a clean JSON v1 result for ${root}.`);
    }
    return { root, report };
  });

  const suppressionCount = reports.reduce((total, { report }) => total + report.summary.suppressed, 0);
  if (suppressionCount <= 0) {
    throw new Error("The built EEZ self-scan did not exercise any suppressions.");
  }

  for (const { root, report } of reports) {
    const github = spawnSync(process.execPath, [builtCli, "check", root, "--format", "github"], {
      cwd: repoRoot,
      encoding: "utf8",
      windowsHide: true,
    });
    const githubOutput = github.stdout ?? "";
    const suppressionSummary = report.summary.suppressed === 0
      || githubOutput.includes(`${report.summary.suppressed} suppression(s)`);
    if (
      github.error
      || github.status !== 0
      || githubOutput.includes("::error")
      || githubOutput.includes("::warning")
      || !suppressionSummary
    ) {
      throw new Error(`The built EEZ GitHub-format self-scan was not clean for ${root}.`);
    }

    const htmlPath = join(tempRoot, `self-scan-${root}.html`);
    const htmlResult = spawnSync(process.execPath, [
      builtCli,
      "check",
      root,
      "--format",
      "json",
      "--report",
      "html",
      "--output",
      htmlPath,
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      windowsHide: true,
    });
    let htmlReport;
    try {
      htmlReport = JSON.parse(htmlResult.stdout);
    } catch {
      throw new Error(`The built EEZ HTML self-scan did not return valid JSON for ${root}.`);
    }
    const html = existsSync(htmlPath) ? readFileSync(htmlPath, "utf8") : "";
    if (
      htmlResult.error
      || htmlResult.status !== 0
      || htmlReport.schemaVersion !== 1
      || !Array.isArray(htmlReport.findings)
      || !Array.isArray(htmlReport.errors)
      || htmlReport.findings.length !== 0
      || htmlReport.errors.length !== 0
      || !html.includes("No active findings")
      || /<(?:script|link|img)\b/i.test(html)
      || /(?:src|href)=["']https?:/i.test(html)
    ) {
      throw new Error(`The built EEZ HTML self-scan was not clean and self-contained for ${root}.`);
    }
  }

  console.log(`Self-scan passed for src and tests (0 active findings, ${suppressionCount} suppression(s)).`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
