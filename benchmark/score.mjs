import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BENCHMARK_SCHEMA_VERSION = 1;
const REQUIRED_POSITIVE_CATEGORIES = new Set([
  "positives/direct",
  "positives/concat",
  "positives/tool-arg",
]);
const NEGATIVE_CATEGORIES = new Set([
  "negatives/sanitized",
  "negatives/benign",
  "negatives/shadowed",
  "negatives/no-tool-args",
]);
const CATEGORY_ORDER = [
  ...REQUIRED_POSITIVE_CATEGORIES,
  ...NEGATIVE_CATEGORIES,
  "known-gaps",
];

const benchmarkRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(benchmarkRoot, "..");
const corpusRoot = join(benchmarkRoot, "corpus");
const builtCli = join(repoRoot, "dist", "cli.js");

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePath(value, description) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${description} must be a non-empty string.`);
  }
  const portable = value.replaceAll("\\", "/");
  if (isAbsolute(value) || /^[A-Za-z]:\//.test(portable) || portable.startsWith("/")) {
    throw new Error(`${description} must be relative to the corpus root: ${value}`);
  }
  const normalized = posix.normalize(portable).replace(/^\.\//, "");
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`${description} escapes the corpus root: ${value}`);
  }
  return normalized;
}

function categoryOf(path) {
  const parts = path.split("/");
  if (parts[0] === "known-gaps" && parts.length >= 2) return "known-gaps";
  const category = parts.slice(0, 2).join("/");
  if ((REQUIRED_POSITIVE_CATEGORIES.has(category) || NEGATIVE_CATEGORIES.has(category)) && parts.length >= 3) {
    return category;
  }
  throw new Error(`Corpus path is outside the declared categories: ${path}`);
}

function corpusFiles(directory, prefix = "") {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relativePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...corpusFiles(join(directory, entry.name), relativePath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(normalizePath(relativePath, "Corpus file path"));
    }
  }
  return files;
}

function loadManifest() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(benchmarkRoot, "expected.json"), "utf8"));
  } catch (error) {
    throw new Error(`expected.json is not valid JSON: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  if (!isRecord(manifest) || manifest.schemaVersion !== BENCHMARK_SCHEMA_VERSION || !Array.isArray(manifest.cases)) {
    throw new Error("expected.json must contain schemaVersion 1 and a cases array.");
  }

  const labels = new Map();
  for (const [index, entry] of manifest.cases.entries()) {
    if (!isRecord(entry)) throw new Error(`Manifest case ${index} must be an object.`);
    const allowedKeys = new Set(["path", "expected", "gap", "limitation", "provenance"]);
    const unknownKeys = Object.keys(entry).filter((key) => !allowedKeys.has(key));
    if (unknownKeys.length > 0) {
      throw new Error(`Manifest case ${index} has unknown fields: ${unknownKeys.join(", ")}`);
    }
    const path = normalizePath(entry.path, `Manifest case ${index} path`);
    if (!path.endsWith(".ts")) throw new Error(`Manifest case path must name a .ts file: ${path}`);
    if (labels.has(path)) throw new Error(`Duplicate manifest path: ${path}`);
    if (entry.expected !== "finding" && entry.expected !== "clean") {
      throw new Error(`Manifest case ${path} has an invalid expected label.`);
    }
    if (entry.gap !== undefined && entry.gap !== true) {
      throw new Error(`Manifest case ${path} may only set gap to true.`);
    }
    if (entry.provenance !== undefined && (typeof entry.provenance !== "string" || entry.provenance.length === 0)) {
      throw new Error(`Manifest case ${path} has an invalid provenance value.`);
    }
    if (entry.limitation !== undefined && (typeof entry.limitation !== "string" || entry.limitation.length === 0)) {
      throw new Error(`Manifest case ${path} has an invalid limitation value.`);
    }

    const category = categoryOf(path);
    if (category === "known-gaps") {
      if (entry.expected !== "clean" || entry.gap !== true || typeof entry.limitation !== "string") {
        throw new Error(`Known-gap case ${path} must be clean with gap:true and a limitation.`);
      }
    } else if (entry.gap === true) {
      throw new Error(`Only known-gaps cases may set gap:true: ${path}`);
    } else if (REQUIRED_POSITIVE_CATEGORIES.has(category) !== (entry.expected === "finding")) {
      throw new Error(`Manifest label does not match category for ${path}.`);
    }
    labels.set(path, { expected: entry.expected, gap: entry.gap === true, category });
  }

  if (labels.size < 30 || labels.size > 50) {
    throw new Error(`The public corpus must contain 30-50 cases; found ${labels.size}.`);
  }
  for (const category of CATEGORY_ORDER) {
    if (![...labels.values()].some((label) => label.category === category)) {
      throw new Error(`The manifest has no cases for required category ${category}.`);
    }
  }
  return labels;
}

function validateExactFileSet(labels) {
  const files = corpusFiles(corpusRoot);
  const fileSet = new Set(files);
  const missingLabels = files.filter((path) => !labels.has(path));
  const missingFiles = [...labels.keys()].filter((path) => !fileSet.has(path));
  if (missingLabels.length > 0 || missingFiles.length > 0) {
    throw new Error([
      missingLabels.length > 0 ? `Unlabeled corpus files: ${missingLabels.join(", ")}` : "",
      missingFiles.length > 0 ? `Labels without corpus files: ${missingFiles.join(", ")}` : "",
    ].filter(Boolean).join("\n"));
  }
}

function runScanner() {
  if (!existsSync(builtCli)) throw new Error("dist/cli.js is missing. Run npm run build before scoring the corpus.");
  const result = spawnSync(process.execPath, [builtCli, "check", corpusRoot, "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw new Error(`Unable to run the built CLI: ${result.error.message}`);
  if (result.signal !== null || result.status !== 1) {
    throw new Error(`The built CLI exited unexpectedly (status ${String(result.status)}, signal ${String(result.signal)}).`);
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error("The built CLI did not return valid JSON.");
  }
  if (
    !isRecord(report)
    || report.schemaVersion !== 1
    || !Array.isArray(report.findings)
    || !Array.isArray(report.errors)
    || !Array.isArray(report.suppressed)
    || !isRecord(report.summary)
    || typeof report.summary.check !== "number"
    || typeof report.summary.audit !== "number"
    || typeof report.summary.suppressed !== "number"
    || typeof report.summary.total !== "number"
    || report.scanComplete !== true
  ) {
    throw new Error("The built CLI returned a malformed JSON v1 report.");
  }
  if (report.errors.length > 0) {
    throw new Error(`The corpus scan reported scanner errors: ${JSON.stringify(report.errors)}`);
  }
  if (report.suppressed.length > 0 || report.summary.suppressed !== 0) {
    throw new Error("The corpus must not use suppressions; suppressed findings are not benchmark detections.");
  }
  if (
    report.summary.check !== report.findings.length
    || report.summary.audit !== 0
    || report.summary.total !== report.findings.length
  ) {
    throw new Error("The corpus report summary is inconsistent with its findings.");
  }
  return report;
}

function detectedPaths(report, labels) {
  const detected = new Set();
  for (const [index, finding] of report.findings.entries()) {
    if (!isRecord(finding) || finding.ruleId !== "llm-output-to-shell" || finding.tier !== "check") {
      throw new Error(`Unexpected finding at report index ${index}.`);
    }
    const path = normalizePath(finding.file, `Finding ${index} file`);
    if (!labels.has(path)) throw new Error(`Finding reported for an unexpected path: ${path}`);
    if (detected.has(path)) throw new Error(`Multiple findings reported for benchmark case: ${path}`);
    detected.add(path);
  }
  return detected;
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function formatRatio(value) {
  return value === null ? "n/a" : value.toFixed(3);
}

function score(labels, detected) {
  const rows = [];
  for (const category of CATEGORY_ORDER) {
    const cases = [...labels].filter(([, label]) => label.category === category);
    if (cases.length === 0) continue;
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let tn = 0;
    let gapHits = 0;
    for (const [path, label] of cases) {
      const found = detected.has(path);
      if (label.gap) {
        if (found) gapHits++;
      } else if (label.expected === "finding") {
        if (found) tp++;
        else fn++;
      } else if (found) {
        fp++;
      } else {
        tn++;
      }
    }
    rows.push({ category, cases: cases.length, found: cases.filter(([path]) => detected.has(path)).length, tp, fp, fn, tn, gapHits });
  }

  console.log("Category                 Cases Found  TP  FP  FN  TN  Precision Recall");
  for (const row of rows) {
    const precision = ratio(row.tp, row.tp + row.fp);
    const recall = ratio(row.tp, row.tp + row.fn);
    console.log(
      `${row.category.padEnd(24)} ${String(row.cases).padStart(5)} ${String(row.found).padStart(5)}`
      + ` ${String(row.tp).padStart(3)} ${String(row.fp).padStart(3)} ${String(row.fn).padStart(3)} ${String(row.tn).padStart(3)}`
      + ` ${formatRatio(precision).padStart(9)} ${formatRatio(recall).padStart(6)}`,
    );
  }

  const scoredRows = rows.filter((row) => row.category !== "known-gaps");
  const totals = scoredRows.reduce(
    (sum, row) => ({ tp: sum.tp + row.tp, fp: sum.fp + row.fp, fn: sum.fn + row.fn, tn: sum.tn + row.tn }),
    { tp: 0, fp: 0, fn: 0, tn: 0 },
  );
  console.log(
    `Overall (known gaps excluded): TP=${totals.tp} FP=${totals.fp} FN=${totals.fn} TN=${totals.tn}`
    + ` precision=${formatRatio(ratio(totals.tp, totals.tp + totals.fp))}`
    + ` recall=${formatRatio(ratio(totals.tp, totals.tp + totals.fn))}`,
  );

  const failures = [];
  for (const row of rows.filter((candidate) => REQUIRED_POSITIVE_CATEGORIES.has(candidate.category))) {
    const recall = ratio(row.tp, row.tp + row.fn);
    if (recall === null || recall < 0.9) failures.push(`${row.category} recall ${formatRatio(recall)} is below 0.900`);
  }
  for (const row of rows.filter((candidate) => NEGATIVE_CATEGORIES.has(candidate.category))) {
    if (row.fp > 0) failures.push(`${row.category} produced ${row.fp} false positive(s)`);
  }
  if (failures.length > 0) throw new Error(`Benchmark thresholds failed:\n- ${failures.join("\n- ")}`);
}

const labels = loadManifest();
validateExactFileSet(labels);
const report = runScanner();
score(labels, detectedPaths(report, labels));
