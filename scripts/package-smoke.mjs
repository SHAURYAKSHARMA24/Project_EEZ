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

  writeFileSync(join(cleanRoot, "vulnerable.ts"), `
import { generateText } from "ai";
import { exec } from "node:child_process";
async function vulnerable() {
  const result = await generateText({ prompt: "command" });
  exec(result.text);
}
void vulnerable;
`);
  const vulnerable = spawnSync(
    process.execPath,
    [installedCli, "check", cleanRoot, "--json"],
    { cwd: installRoot, encoding: "utf8", windowsHide: true },
  );
  if (vulnerable.error || vulnerable.status !== 1) {
    throw new Error("The installed CLI did not reject the known M1a vulnerability.");
  }
  let report;
  try {
    report = JSON.parse(vulnerable.stdout);
  } catch {
    throw new Error("The installed CLI did not return valid JSON for the vulnerable scan.");
  }
  if (
    !Array.isArray(report.findings)
    || report.findings.length !== 1
    || report.findings[0]?.ruleId !== "llm-output-to-shell"
  ) {
    throw new Error("The installed CLI did not report exactly one M1a finding.");
  }

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
