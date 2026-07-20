import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../../src/cli.ts";
import { loadStagedFiles } from "../../src/git/staged.ts";

let root: string;

function git(...args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function vulnerable(): string {
  return `
import { generateText } from "ai";
import { exec } from "node:child_process";
async function run() {
  const result = await generateText({ prompt: "command" });
  exec(result.text);
}
void run;
`;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "preflight-staged-"));
  execFileSync("git", ["init", "-q", root]);
  git("config", "user.email", "preflight@example.invalid");
  git("config", "user.name", "Preflight Test");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("loadStagedFiles", () => {
  it("reads the complete index blob instead of unstaged working-tree content", () => {
    const path = join(root, "partial.ts");
    writeFileSync(path, "export const safe = true;\n");
    git("add", "partial.ts");
    writeFileSync(path, vulnerable());

    expect(loadStagedFiles(root)).toEqual([{
      path: "partial.ts",
      content: "export const safe = true;\n",
      isGitTracked: true,
    }]);
    expect(run(["check", "--staged", "--json"], root).code).toBe(0);

    git("add", "partial.ts");
    writeFileSync(path, "export const safeAgain = true;\n");
    const result = run(["check", "--staged", "--json"], root);
    const report = JSON.parse(result.output);
    expect(result.code).toBe(1);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].ruleId).toBe("llm-output-to-shell");
  });

  it("includes added and renamed regular files while skipping deletions", () => {
    writeFileSync(join(root, "old.ts"), "export const oldName = true;\n");
    writeFileSync(join(root, "deleted.ts"), "export const deleted = true;\n");
    git("add", "old.ts", "deleted.ts");
    git("commit", "-q", "-m", "baseline");

    git("mv", "old.ts", "renamed file.ts");
    git("rm", "-q", "deleted.ts");
    writeFileSync(join(root, "added.ts"), "export const added = true;\n");
    writeFileSync(join(root, "notes.md"), "not scanned\n");
    git("add", "added.ts", "notes.md");

    expect(loadStagedFiles(root).map((file) => file.path)).toEqual([
      "added.ts",
      "renamed file.ts",
    ]);
  });

  it("returns no files and a clean check when no scannable change is staged", () => {
    expect(loadStagedFiles(root)).toEqual([]);
    const result = run(["check", "--staged", "--json"], root);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.output).findings).toEqual([]);
  });

  it("rejects combining staged mode with a path", () => {
    expect(run(["check", ".", "--staged"], root).code).toBe(2);
    expect(run(["audit", ".", "--staged"], root).code).toBe(2);
  });
});
