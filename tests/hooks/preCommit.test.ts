import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../../src/cli.ts";
import { HookInstallError, installPreCommitHook } from "../../src/hooks/preCommit.ts";

let root: string;
let cliPath: string;

function git(...args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function fakeCli(exitCode: number): void {
  writeFileSync(
    cliPath,
    `#!/usr/bin/env node\nif (process.argv.slice(2).join(" ") !== "check --staged") process.exit(2);\nprocess.exit(${exitCode});\n`,
  );
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "preflight-hook-"));
  execFileSync("git", ["init", "-q", root]);
  git("config", "user.email", "preflight@example.invalid");
  git("config", "user.name", "Preflight Test");
  cliPath = join(root, "node_modules", "preflight", "dist", "cli.js");
  mkdirSync(join(root, "node_modules", "preflight", "dist"), { recursive: true });
  fakeCli(0);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("installPreCommitHook", () => {
  it("installs an idempotent marked hook for the local package", () => {
    const first = installPreCommitHook(root);
    const content = readFileSync(first.hookPath, "utf8");

    expect(first.status).toBe("installed");
    expect(content).toContain("preflight-managed-hook v1");
    expect(content).toContain("check --staged");
    expect(content).toContain("node_modules/preflight/dist/cli.js");
    if (process.platform !== "win32") {
      expect(statSync(first.hookPath).mode & 0o111).not.toBe(0);
    }

    expect(installPreCommitHook(root)).toMatchObject({
      status: "already-installed",
      hookPath: first.hookPath,
    });
  });

  it("preserves a different existing hook byte for byte", () => {
    const hookPath = join(root, ".git", "hooks", "pre-commit");
    const existing = "#!/bin/sh\necho existing\n";
    writeFileSync(hookPath, existing);

    expect(() => installPreCommitHook(root)).toThrowError(HookInstallError);
    expect(() => installPreCommitHook(root)).toThrow(/already exists.*preflight check --staged/i);
    expect(readFileSync(hookPath, "utf8")).toBe(existing);
  });

  it("requires a repository-local preflight CLI", () => {
    rmSync(join(root, "node_modules"), { recursive: true, force: true });

    expect(() => installPreCommitHook(root)).toThrow(/local preflight installation/i);
  });

  it("propagates the installed hook result through a real Git commit", () => {
    installPreCommitHook(root);
    writeFileSync(join(root, "value.ts"), "export const value = true;\n");
    git("add", "value.ts");
    fakeCli(1);

    const blocked = spawnSync("git", ["-C", root, "commit", "-q", "-m", "blocked"], {
      encoding: "utf8",
      windowsHide: true,
    });
    expect(blocked.status).not.toBe(0);
    expect(spawnSync("git", ["-C", root, "rev-parse", "--verify", "HEAD"]).status).not.toBe(0);

    fakeCli(0);
    git("commit", "-q", "-m", "allowed");
    expect(git("rev-list", "--count", "HEAD").trim()).toBe("1");
  });

  it("exposes installation through the CLI and rejects scan flags", () => {
    expect(run(["install-hook"], root)).toEqual({
      code: 0,
      output: "Installed preflight pre-commit hook.",
    });
    expect(run(["install-hook"], root)).toEqual({
      code: 0,
      output: "Preflight pre-commit hook is already installed.",
    });
    expect(run(["install-hook", "--staged"], root).code).toBe(2);
    expect(run(["install-hook", "--json"], root).code).toBe(2);
  });
});
