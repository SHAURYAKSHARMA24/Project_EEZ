#!/usr/bin/env node
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { realpathSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectFiles, loadFiles } from "./walk.ts";
import { loadStagedFiles } from "./git/staged.ts";
import { HookInstallError, installPreCommitHook } from "./hooks/preCommit.ts";
import { scanFiles } from "./scan.ts";
import { renderSober } from "./report/sober.ts";
import { renderJson } from "./report/json.ts";
import { renderGithub } from "./report/github.ts";
import { renderHtml } from "./report/html.ts";
import { allRules } from "./rules/index.ts";
import { redactKnownSecrets } from "./redact.ts";
import { getVersion } from "./version.ts";
import type { RuleError } from "./types.ts";

type Command = "check" | "audit";
type OutputFormat = "sober" | "json" | "github";

const KNOWN_COMMANDS = new Set<Command>(["check", "audit"]);
const USAGE = "Usage: preflight <check|audit> [path] [--staged] [--json | --format sober|json|github] [--report html --output <file>]";
const INSTALL_HOOK_USAGE = "Usage: preflight install-hook";
const HELP = [
  USAGE,
  "",
  "Commands:",
  "  check [path]   Run blocking checks (default command).",
  "  audit [path]   Run non-blocking review; findings exit 0, but usage, I/O,",
  "                 parse, rule, suppression, and report-write diagnostics",
  "                 still exit 2.",
  "  install-hook   Install a staged-only pre-commit hook.",
  "",
  "Flags:",
  "  --staged       Scan complete staged Git blobs instead of a path.",
  "  --json         Emit machine-readable JSON.",
  "  --format       Select sober, json, or github output.",
  "  --report html  Write a self-contained HTML sidecar.",
  "  --output FILE  Path for the HTML sidecar.",
  "  -h, --help     Show this help text.",
  "  -v, --version  Print the installed version.",
].join("\n");

// The single source of truth for the CLI option schema. `intendedCommand` and
// the strict parse below both consume it so the two phases can never disagree
// about which tokens are option values versus positionals.
const CLI_OPTIONS = {
  json: { type: "boolean", default: false },
  format: { type: "string" },
  report: { type: "string" },
  output: { type: "string" },
  staged: { type: "boolean", default: false },
  help: { type: "boolean", short: "h", default: false },
  version: { type: "boolean", short: "v", default: false },
} as const;

function isCommand(value: string): value is Command {
  return KNOWN_COMMANDS.has(value as Command);
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function resolveCommand(
  positionals: string[],
  cwd: string,
  staged: boolean,
): { command: Command; root: string } | { usageError: string } {
  if (staged) {
    if (positionals.length === 0) return { command: "check", root: cwd };
    if (positionals.length === 1 && isCommand(positionals[0])) {
      return { command: positionals[0], root: cwd };
    }
    return { usageError: USAGE };
  }
  if (positionals.length === 0) return { command: "check", root: cwd };

  const [first, ...rest] = positionals;
  if (isCommand(first)) {
    if (rest.length > 1) return { usageError: USAGE };
    return { command: first, root: rest[0] === undefined ? cwd : resolve(cwd, rest[0]) };
  }

  if (rest.length === 0 && isDirectory(resolve(cwd, first))) {
    return { command: "check", root: resolve(cwd, first) };
  }

  return {
    usageError: `Unknown command "${redactKnownSecrets(first)}". ${USAGE}`,
  };
}

function renderOutput(
  format: OutputFormat,
  findings: import("./types.ts").Finding[],
  errors: RuleError[],
  suppressed: import("./types.ts").Suppression[] = [],
  scanComplete = true,
): string {
  if (format === "json") return renderJson(findings, errors, suppressed, scanComplete);
  if (format === "github") return renderGithub(findings, errors, suppressed);
  return renderSober(findings, errors, suppressed);
}

// Operational/diagnostic failures (usage errors, I/O errors, parse failures,
// rule errors, suppression diagnostics, report-write failures, incomplete
// scans) always exit 2, in both check and audit mode. Audit only stays
// non-blocking (exit 0) for findings themselves.
function diagnosticResult(format: OutputFormat, message: string): { code: number; output: string } {
  const errors: RuleError[] = [{ ruleId: "scanner", file: ".", message }];
  return {
    code: 2,
    output: renderOutput(format, [], errors, [], false),
  };
}

// Determine which command the user intended, without validating anything, so a
// later strict-parse or scan failure still exits with the correct code. Reusing
// the real option schema in a tolerant pass means value-taking flags such as
// `--format json` (space or `=` form, in any position) never leak their value
// into the positional stream, and a value that merely spells "audit" is not
// mistaken for the command. `audit` is the command only as the first positional.
function intendedCommand(argv: string[]): Command {
  try {
    const { positionals } = parseArgs({
      args: argv,
      options: CLI_OPTIONS,
      allowPositionals: true,
      strict: false,
    });
    return positionals[0] === "audit" ? "audit" : "check";
  } catch {
    return "check";
  }
}

export function run(argv: string[], cwd: string): { code: number; output: string } {
  let command = intendedCommand(argv);
  let format: OutputFormat = "sober";

  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: CLI_OPTIONS,
    });
    if (values.help && values.version) return { code: 2, output: USAGE };
    if (values.help) return { code: 0, output: HELP };
    if (values.version) return { code: 0, output: getVersion() };

    const explicitFormat = values.format;
    if (
      (explicitFormat !== undefined && !["sober", "json", "github"].includes(explicitFormat))
      || (values.json && explicitFormat !== undefined && explicitFormat !== "json")
    ) {
      return { code: 2, output: USAGE };
    }
    format = values.json ? "json" : (explicitFormat as OutputFormat | undefined) ?? "sober";
    if (
      (values.report === undefined) !== (values.output === undefined)
      || (values.report !== undefined && values.report !== "html")
    ) {
      return { code: 2, output: USAGE };
    }

    if (positionals[0] === "install-hook") {
      if (
        positionals.length !== 1
        || values.staged
        || values.json
        || values.format !== undefined
        || values.report !== undefined
        || values.output !== undefined
      ) {
        return { code: 2, output: INSTALL_HOOK_USAGE };
      }
      try {
        const installed = installPreCommitHook(cwd);
        return {
          code: 0,
          output: installed.status === "installed"
            ? "Installed preflight pre-commit hook."
            : "Preflight pre-commit hook is already installed.",
        };
      } catch (error) {
        return {
          code: 2,
          output: error instanceof HookInstallError
            ? error.message
            : "Unable to install the preflight hook.",
        };
      }
    }

    const resolution = resolveCommand(positionals, cwd, values.staged);
    if ("usageError" in resolution) {
      return { code: 2, output: resolution.usageError };
    }
    command = resolution.command;

    const files = values.staged
      ? loadStagedFiles(cwd)
      : loadFiles(resolution.root, collectFiles(resolution.root));
    const { findings, checkFailures, errors, suppressed } = scanFiles(files, allRules);

    const shown = command === "audit" ? findings : findings.filter((f) => f.tier === "check");
    // Suppression diagnostics (malformed, unknown-rule, stale directives) are
    // hygiene problems in a scan that ran to completion, so they leave
    // scanComplete true. Only a scanner abort or a rule that could not read a
    // file means the scan itself is incomplete.
    const scanComplete = errors.every((error) => error.ruleId === "suppression");
    if (values.report === "html" && values.output !== undefined) {
      writeFileSync(resolve(cwd, values.output), renderHtml(shown, errors, suppressed), "utf8");
    }
    const output = renderOutput(format, shown, errors, suppressed, scanComplete);
    // Findings never fail audit mode (non-blocking review); operational and
    // diagnostic failures reported via `errors` always exit 2, matching check.
    const code = errors.length > 0 ? 2 : command === "audit" ? 0 : checkFailures.length > 0 ? 1 : 0;
    return { code, output };
  } catch {
    return diagnosticResult(format, "Unable to complete the scan.");
  }
}

// npm's bin shims are symlinks on POSIX (node_modules/.bin/preflight -> dist/cli.js).
// import.meta.url is the resolved real path, so argv[1] must be realpath'd to match.
function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  const { code, output } = run(process.argv.slice(2), process.cwd());
  console.log(output);
  process.exit(code);
}
