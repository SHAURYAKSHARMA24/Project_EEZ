import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, basename, extname } from "node:path";
import { analyzeProject, type ProjectAnalysis } from "./ast/analysis.ts";
import type { LoadedFile } from "./types.ts";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  ".turbo",
  ".cache",
]);
const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

export function isScannablePath(name: string): boolean {
  return CODE_EXTS.has(extname(name)) || basename(name).startsWith(".env");
}

export function collectFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) walk(abs);
      } else if (entry.isFile() && isScannablePath(entry.name)) {
        out.push(relative(root, abs).split("\\").join("/"));
      }
    }
  };
  walk(root);
  return out.sort();
}

function errorStderr(error: unknown): string {
  if (typeof error !== "object" || error === null || !("stderr" in error)) return "";
  const stderr = error.stderr;
  if (typeof stderr === "string") return stderr;
  return Buffer.isBuffer(stderr) ? stderr.toString("utf8") : "";
}

function isGitWorktree(root: string): boolean {
  try {
    const output = execFileSync("git", ["-C", root, "rev-parse", "--is-inside-work-tree"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output.trim() === "true";
  } catch (error) {
    if (/not a git repository/i.test(errorStderr(error))) return false;
    throw new Error("Could not determine Git tracking state.");
  }
}

function gitTrackedFiles(root: string, candidates: string[]): Set<string> {
  if (!isGitWorktree(root)) return new Set();

  const tracked = new Set<string>();
  for (let i = 0; i < candidates.length; i += 100) {
    try {
      const output = execFileSync("git", ["-C", root, "ls-files", "-z", "--", ...candidates.slice(i, i + 100)], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      for (const path of output.split("\0")) {
        if (path) tracked.add(path.split("\\").join("/"));
      }
    } catch {
      throw new Error("Could not determine Git tracking state.");
    }
  }
  return tracked;
}

export function loadFiles(root: string, relPaths: string[]): LoadedFile[] {
  const envPaths = relPaths.filter((path) => basename(path).startsWith(".env"));
  const tracked = envPaths.length > 0
    ? gitTrackedFiles(root, envPaths)
    : new Set<string>();
  return relPaths.map((p) => ({
    path: p,
    content: readFileSync(join(root, p), "utf8"),
    isGitTracked: tracked.has(p),
  }));
}

export function analyzeFiles(files: LoadedFile[]): ProjectAnalysis {
  return analyzeProject(files.map(({ path, content }) => ({ path, content })));
}
