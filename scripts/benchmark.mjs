import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const TARGET_MS = 3_000;
const CEILING_MS = 12_000;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builtCli = join(repoRoot, "dist", "cli.js");
const tempRoot = mkdtempSync(join(tmpdir(), "preflight-benchmark-"));

try {
  if (!existsSync(builtCli)) {
    throw new Error("dist/cli.js is missing. Run npm run build before the benchmark.");
  }

  // Deterministic 500-file mix: 50 M1a positives followed by 450 clean modules.
  for (let index = 0; index < 50; index++) {
    writeFileSync(join(tempRoot, `positive-${index.toString().padStart(3, "0")}.ts`), `
import { generateText } from "ai";
import { exec } from "node:child_process";
async function vulnerable() {
  const result = await generateText({ prompt: "command ${index}" });
  exec(result.text);
}
void vulnerable;
`);
  }
  for (let index = 0; index < 450; index++) {
    writeFileSync(
      join(tempRoot, `clean-${index.toString().padStart(3, "0")}.ts`),
      `export const clean${index} = ${index};\n`,
    );
  }

  const started = performance.now();
  const result = spawnSync(process.execPath, [builtCli, "check", tempRoot, "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  const elapsedMs = performance.now() - started;
  if (result.error || result.status !== 1) {
    throw new Error("The built CLI benchmark scan did not exit with the expected finding status.");
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error("The built CLI benchmark did not return valid JSON.");
  }
  if (
    !Array.isArray(report.findings)
    || report.findings.length !== 50
    || !Array.isArray(report.errors)
    || report.errors.length !== 0
    || report.findings.some((finding) => finding.ruleId !== "llm-output-to-shell")
  ) {
    throw new Error("The built CLI benchmark failed its correctness gate.");
  }

  console.log(`Benchmark: ${elapsedMs.toFixed(1)} ms for 500 files (50 M1a findings).`);
  if (elapsedMs > TARGET_MS) {
    console.warn(`Benchmark exceeded the ${TARGET_MS} ms performance target.`);
  }
  if (elapsedMs > CEILING_MS) {
    throw new Error(`Benchmark exceeded the ${CEILING_MS} ms hard CI ceiling.`);
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
