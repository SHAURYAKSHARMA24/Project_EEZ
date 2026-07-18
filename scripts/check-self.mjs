import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builtCli = join(repoRoot, "dist", "cli.js");
const tempRoot = mkdtempSync(join(tmpdir(), "preflight-self-scan-"));

if (!existsSync(builtCli)) {
  throw new Error("dist/cli.js is missing. Run npm run build before the self-scan.");
}

try {
  const result = spawnSync(process.execPath, [builtCli, "check", ".", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    throw new Error("The built preflight self-scan failed.");
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error("The built preflight self-scan did not return valid JSON.");
  }

  if (
    report.schemaVersion !== 1 ||
    !Array.isArray(report.findings) ||
    !Array.isArray(report.errors) ||
    typeof report.summary?.check !== "number" ||
    typeof report.summary?.audit !== "number" ||
    typeof report.summary?.suppressed !== "number" ||
    typeof report.summary?.total !== "number" ||
    report.findings.length !== 0 ||
    report.errors.length !== 0 ||
    report.summary.check !== 0 ||
    report.summary.audit !== 0 ||
    report.summary.total !== 0 ||
    report.summary.suppressed <= 0
  ) {
    throw new Error("The built preflight self-scan did not produce a clean JSON v1 result with suppressions.");
  }

  const github = spawnSync(process.execPath, [builtCli, "check", ".", "--format", "github"], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  if (
    github.error
    || github.status !== 0
    || github.stdout.includes("::error")
    || github.stdout.includes("::warning")
    || !github.stdout.includes(`${report.summary.suppressed} suppression(s)`)
  ) {
    throw new Error("The built preflight GitHub-format self-scan was not clean.");
  }

  const htmlPath = join(tempRoot, "self-scan.html");
  const htmlResult = spawnSync(process.execPath, [
    builtCli,
    "check",
    ".",
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
  const html = existsSync(htmlPath) ? readFileSync(htmlPath, "utf8") : "";
  if (
    htmlResult.error
    || htmlResult.status !== 0
    || JSON.parse(htmlResult.stdout).schemaVersion !== 1
    || !html.includes("No active findings")
    || /<(?:script|link|img)\b/i.test(html)
    || /(?:src|href)=["']https?:/i.test(html)
  ) {
    throw new Error("The built preflight HTML self-scan was not clean and self-contained.");
  }

  console.log(`Self-scan passed (0 active findings, ${report.summary.suppressed} suppression(s)).`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
