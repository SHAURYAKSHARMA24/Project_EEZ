import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? process.execPath : "npm";
const npmCliArgs = process.platform === "win32"
  ? [join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")]
  : [];
const tempRoot = mkdtempSync(join(tmpdir(), "preflight-package-smoke-"));
const cacheRoot = join(tempRoot, "npm-cache");

function runNpm(args, cwd) {
  const result = spawnSync(npm, [...npmCliArgs, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_cache: cacheRoot,
      npm_config_fund: "false",
      npm_config_update_notifier: "false",
    },
    windowsHide: true,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`npm ${args[0]} failed${detail ? `:\n${detail}` : ""}`);
  }
  return result.stdout;
}

function runNode(args, cwd, expectedStatus = 0) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== expectedStatus) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`node ${args[0]} exited ${result.status}, expected ${expectedStatus}${detail ? `:\n${detail}` : ""}`);
  }
  return result;
}

function runGit(args, cwd, expectedStatus = 0) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== expectedStatus) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`git ${args[0]} exited ${result.status}, expected ${expectedStatus}${detail ? `:\n${detail}` : ""}`);
  }
  return result;
}

function isWithin(root, candidate) {
  const path = relative(root, candidate);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

try {
  const builtCli = join(repoRoot, "dist", "cli.js");
  if (!existsSync(builtCli)) {
    throw new Error("dist/cli.js is missing. Run npm run build before the package smoke test.");
  }

  const packageVersion = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version;
  const packRoot = join(tempRoot, "pack");
  const installRoot = join(tempRoot, "install");
  const cleanRoot = join(tempRoot, "clean");
  mkdirSync(packRoot);
  mkdirSync(installRoot);
  mkdirSync(cleanRoot);

  const packed = JSON.parse(runNpm(["pack", "--json", "--pack-destination", packRoot], repoRoot));
  if (!Array.isArray(packed) || packed.length !== 1 || typeof packed[0]?.filename !== "string") {
    throw new Error("npm pack did not report exactly one package tarball.");
  }

  const tarball = join(packRoot, packed[0].filename);
  if (!existsSync(tarball)) throw new Error("npm pack did not create its reported tarball.");

  writeFileSync(join(installRoot, "package.json"), '{"private":true}\n');
  runNpm(
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-save", "--package-lock=false", tarball],
    installRoot,
  );

  const installedPreflightDir = join(installRoot, "node_modules", "preflight");
  const installedCli = join(installedPreflightDir, "dist", "cli.js");
  if (!existsSync(installedCli)) {
    throw new Error("The installed package is missing dist/cli.js.");
  }
  const installedBundle = readFileSync(installedCli, "utf8");
  if (!/from\s+["']typescript["']/.test(installedBundle)) {
    throw new Error("The installed CLI does not retain its external TypeScript package import.");
  }

  const binName = process.platform === "win32" ? "preflight.cmd" : "preflight";
  if (!existsSync(join(installRoot, "node_modules", ".bin", binName))) {
    throw new Error("The installed package did not create the preflight bin entry.");
  }

  const versionOutput = runNpm(["exec", "--", "preflight", "--version"], installRoot);
  if (!versionOutput.includes(packageVersion)) {
    throw new Error("The installed preflight bin did not report the packaged version.");
  }

  writeFileSync(join(cleanRoot, "clean.ts"), "export const clean = true;\n");
  runNpm(["exec", "--", "preflight", "check", cleanRoot], installRoot);

  const vulnerableSource = `
import { generateText } from "ai";
import { exec } from "node:child_process";
async function vulnerable() {
  const result = await generateText({ prompt: "command" });
  exec(result.text);
}
void vulnerable;
`;
  writeFileSync(join(cleanRoot, "vulnerable.ts"), vulnerableSource);
  const vulnerable = runNode([installedCli, "check", cleanRoot, "--json"], installRoot, 1);
  let report;
  try {
    report = JSON.parse(vulnerable.stdout);
  } catch {
    throw new Error("The installed CLI did not return valid JSON for the vulnerable scan.");
  }
  if (
    report.schemaVersion !== 1
    ||
    !Array.isArray(report.findings)
    || report.findings.length !== 1
    || report.findings[0]?.ruleId !== "llm-output-to-shell"
  ) {
    throw new Error("The installed CLI did not report exactly one M1a finding.");
  }

  const github = runNode(
    [installedCli, "check", cleanRoot, "--format", "github"],
    installRoot,
    1,
  );
  if (!github.stdout.includes("::error file=vulnerable.ts") || github.stdout.includes("::warning")) {
    throw new Error("The installed CLI did not emit the expected GitHub annotation.");
  }

  const htmlPath = join(tempRoot, "report.html");
  const htmlResult = runNode([
    installedCli,
    "check",
    cleanRoot,
    "--format",
    "json",
    "--report",
    "html",
    "--output",
    htmlPath,
  ], installRoot, 1);
  if (JSON.parse(htmlResult.stdout).schemaVersion !== 1 || !existsSync(htmlPath)) {
    throw new Error("The installed CLI did not emit JSON v1 with an HTML sidecar.");
  }
  const html = readFileSync(htmlPath, "utf8");
  if (
    !html.includes("llm-output-to-shell")
    || !html.includes("Recommended fix")
    || /<(?:script|link|img)\b/i.test(html)
    || /(?:src|href)=["']https?:/i.test(html)
  ) {
    throw new Error("The installed CLI HTML report was incomplete or not self-contained.");
  }

  runGit(["init", "-q"], installRoot);
  runGit(["config", "user.name", "Preflight Smoke"], installRoot);
  runGit(["config", "user.email", "preflight-smoke@example.invalid"], installRoot);
  const stagedPath = join(installRoot, "staged.ts");
  writeFileSync(stagedPath, vulnerableSource);
  runGit(["add", "staged.ts"], installRoot);

  const staged = runNode([installedCli, "check", "--staged", "--json"], installRoot, 1);
  const stagedReport = JSON.parse(staged.stdout);
  if (stagedReport.schemaVersion !== 1 || stagedReport.findings?.length !== 1) {
    throw new Error("The installed CLI did not scan the exact staged vulnerability.");
  }
  const hookInstall = runNode([installedCli, "install-hook"], installRoot);
  if (!hookInstall.stdout.includes("Installed preflight pre-commit hook.")) {
    throw new Error("The installed CLI did not install its pre-commit hook.");
  }
  const blockedCommit = spawnSync("git", ["commit", "-m", "blocked"], {
    cwd: installRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  if (blockedCommit.error) throw blockedCommit.error;
  const blockedOutput = `${blockedCommit.stdout}\n${blockedCommit.stderr}`;
  if (blockedCommit.status === 0 || !blockedOutput.includes("LLM output reaches shell execution")) {
    throw new Error("The installed pre-commit hook did not block an active staged finding.");
  }
  writeFileSync(stagedPath, "export const safe = true;\n");
  runGit(["add", "staged.ts"], installRoot);
  runGit(["commit", "-q", "-m", "allowed"], installRoot);

  const requireFromPackage = createRequire(join(installedPreflightDir, "package.json"));
  const resolvedTypeScript = realpathSync(requireFromPackage.resolve("typescript"));
  const installReal = realpathSync(installRoot);
  const repoReal = realpathSync(repoRoot);
  const allowedTypeScriptRoots = [
    join(installReal, "node_modules", "typescript"),
    join(installReal, "node_modules", "preflight", "node_modules", "typescript"),
  ].filter(existsSync).map((path) => realpathSync(path));
  if (
    !allowedTypeScriptRoots.some((root) => isWithin(root, resolvedTypeScript))
    || !isWithin(installReal, resolvedTypeScript)
    || isWithin(repoReal, resolvedTypeScript)
  ) {
    throw new Error("The installed package did not resolve TypeScript from its isolated installation.");
  }
  console.log("Package smoke test passed.");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
