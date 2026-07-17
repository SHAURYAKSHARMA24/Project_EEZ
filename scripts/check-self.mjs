import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builtCli = join(repoRoot, "dist", "cli.js");

if (!existsSync(builtCli)) {
  throw new Error("dist/cli.js is missing. Run npm run build before the self-scan.");
}

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
  throw new Error("The built preflight self-scan did not produce a clean, suppressed result.");
}

console.log(`Self-scan passed (${report.summary.suppressed} suppression(s)).`);
