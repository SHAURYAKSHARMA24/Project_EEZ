import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export class HookInstallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HookInstallError";
  }
}

function git(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new HookInstallError("Preflight could not locate a Git worktree.");
  }
}

function localCli(root: string): string {
  const candidates = [
    join(root, "node_modules", "preflight", "dist", "cli.js"),
    join(root, "dist", "cli.js"),
  ];
  const cli = candidates.find(existsSync);
  if (!cli) {
    throw new HookInstallError(
      "A repository-local preflight installation is required before installing the hook.",
    );
  }
  return relative(root, cli).split("\\").join("/");
}

function hookContent(cliPath: string): string {
  return [
    "#!/bin/sh",
    "# preflight-managed-hook v1",
    "root=\"$(git rev-parse --show-toplevel)\" || exit 2",
    `cli="$root/${cliPath}"`,
    "if [ ! -f \"$cli\" ]; then",
    "  echo \"preflight: local CLI is missing; reinstall dependencies or rerun preflight install-hook.\" >&2",
    "  exit 2",
    "fi",
    "exec node \"$cli\" check --staged",
    "",
  ].join("\n");
}

export function installPreCommitHook(cwd: string): {
  status: "installed" | "already-installed";
  hookPath: string;
} {
  const root = git(cwd, ["rev-parse", "--show-toplevel"]);
  const cli = localCli(root);
  const gitHookPath = git(root, ["rev-parse", "--git-path", "hooks/pre-commit"]);
  const hookPath = isAbsolute(gitHookPath) ? gitHookPath : resolve(root, gitHookPath);
  const content = hookContent(cli);

  if (existsSync(hookPath)) {
    if (readFileSync(hookPath, "utf8") === content) {
      return { status: "already-installed", hookPath };
    }
    throw new HookInstallError(
      "A different pre-commit hook already exists. Preserve it and add `preflight check --staged` manually.",
    );
  }

  mkdirSync(dirname(hookPath), { recursive: true });
  writeFileSync(hookPath, content, "utf8");
  chmodSync(hookPath, 0o755);
  return { status: "installed", hookPath };
}
