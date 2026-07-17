#!/usr/bin/env node
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { analyzeFiles, collectFiles, loadFiles } from "./walk.ts";
import { runRules } from "./engine.ts";
import { renderSober } from "./report/sober.ts";
import { renderJson } from "./report/json.ts";
import { allRules } from "./rules/index.ts";
import { redactKnownSecrets } from "./redact.ts";
import { getVersion } from "./version.ts";
import type { RuleError } from "./types.ts";

type Command = "check" | "audit";

const KNOWN_COMMANDS = new Set<Command>(["check", "audit"]);
const USAGE = "Usage: preflight <check|audit> [path] [--json]";
const HELP = [
  USAGE,
  "",
  "Commands:",
  "  check [path]   Run blocking checks (default command).",
  "  audit [path]   Run non-blocking review; always exits 0.",
  "",
  "Flags:",
  "  --json         Emit machine-readable JSON.",
  "  -h, --help     Show this help text.",
  "  -v, --version  Print the installed version.",
].join("\n");

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
): { command: Command; root: string } | { usageError: string } {
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

function diagnosticResult(command: Command, json: boolean, message: string): { code: number; output: string } {
  const errors: RuleError[] = [{ ruleId: "scanner", file: ".", message }];
  return {
    code: command === "audit" ? 0 : 2,
    output: json ? renderJson([], errors) : renderSober([], errors),
  };
}

function intendedCommand(argv: string[]): Command {
  for (const argument of argv) {
    if (argument.startsWith("-")) continue;
    return argument === "audit" ? "audit" : "check";
  }
  return "check";
}

export function run(argv: string[], cwd: string): { code: number; output: string } {
  let command = intendedCommand(argv);
  let json = false;

  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        json: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
        version: { type: "boolean", short: "v", default: false },
      },
    });
    json = values.json;

    if (values.help && values.version) return { code: 2, output: USAGE };
    if (values.help) return { code: 0, output: HELP };
    if (values.version) return { code: 0, output: getVersion() };

    const resolution = resolveCommand(positionals, cwd);
    if ("usageError" in resolution) {
      return { code: command === "audit" ? 0 : 2, output: resolution.usageError };
    }
    command = resolution.command;

    const files = loadFiles(resolution.root, collectFiles(resolution.root));
    const analysis = analyzeFiles(files);
    const { findings, checkFailures, errors, suppressed } = runRules(files, allRules, analysis);

    const shown = command === "audit" ? findings : findings.filter((f) => f.tier === "check");
    const output = json
      ? renderJson(shown, errors, suppressed)
      : renderSober(shown, errors, suppressed);
    const code = command === "audit" ? 0 : errors.length > 0 ? 2 : checkFailures.length > 0 ? 1 : 0;
    return { code, output };
  } catch {
    return diagnosticResult(command, json, "Unable to complete the scan.");
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
