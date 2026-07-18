import { spawnSync } from "node:child_process";
import type { LoadedFile } from "../types.ts";
import { isScannablePath } from "../walk.ts";

interface IndexEntry {
  mode: string;
  oid: string;
  stage: string;
}

function runGit(cwd: string, args: string[]): Buffer {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: null,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    throw new Error("Unable to read staged Git content.");
  }
  return result.stdout;
}

function nulStrings(buffer: Buffer): string[] {
  return buffer.toString("utf8").split("\0").filter((value) => value.length > 0);
}

function indexEntries(root: string): Map<string, IndexEntry> {
  const entries = new Map<string, IndexEntry>();
  for (const record of nulStrings(runGit(root, ["ls-files", "--stage", "-z"]))) {
    const separator = record.indexOf("\t");
    if (separator < 0) continue;
    const [mode, oid, stage] = record.slice(0, separator).split(" ");
    const path = record.slice(separator + 1);
    if (mode && oid && stage && path) entries.set(path, { mode, oid, stage });
  }
  return entries;
}

export function loadStagedFiles(cwd: string): LoadedFile[] {
  const root = runGit(cwd, ["rev-parse", "--show-toplevel"]).toString("utf8").trim();
  if (root.length === 0) throw new Error("Unable to locate the Git worktree.");

  const changedPaths = nulStrings(runGit(root, [
    "diff",
    "--cached",
    "--name-only",
    "-z",
    "--diff-filter=ACMR",
    "--no-renames",
  ]));
  const entries = indexEntries(root);
  const files: LoadedFile[] = [];

  for (const path of changedPaths) {
    const entry = entries.get(path);
    if (
      !entry
      || entry.stage !== "0"
      || (entry.mode !== "100644" && entry.mode !== "100755")
      || !isScannablePath(path)
    ) {
      continue;
    }
    files.push({
      path,
      content: runGit(root, ["cat-file", "blob", entry.oid]).toString("utf8"),
      isGitTracked: true,
    });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}
