import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectFiles, loadFiles } from "../src/walk.ts";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "preflight-"));
  writeFileSync(join(root, "app.ts"), "const a = 1;");
  writeFileSync(join(root, ".env"), "X=1");
  writeFileSync(join(root, "readme.md"), "# doc");
  mkdirSync(join(root, "node_modules", "pkg"), { recursive: true });
  writeFileSync(join(root, "node_modules", "pkg", "index.js"), "ignored");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("collectFiles", () => {
  it("includes code and .env, excludes node_modules and non-code", () => {
    const files = collectFiles(root);
    expect(files).toContain("app.ts");
    expect(files).toContain(".env");
    expect(files).not.toContain("readme.md");
    expect(files.some((f) => f.includes("node_modules"))).toBe(false);
    expect(files).toEqual([...files].sort());
  });

  it("recurses into subdirs and excludes generated directories", () => {
    mkdirSync(join(root, "src", "nested"), { recursive: true });
    writeFileSync(join(root, "src", "nested", "deep.ts"), "export const d = 1;");
    const ignored = [".git", "dist", "build", ".next", "out", "coverage", ".turbo", ".cache"];
    for (const dir of ignored) {
      mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(join(root, dir, "output.js"), "ignored");
    }
    const files = collectFiles(root);
    expect(files).toContain("src/nested/deep.ts");
    for (const dir of ignored) {
      expect(files.some((f) => f.startsWith(`${dir}/`))).toBe(false);
    }
  });
});

describe("loadFiles", () => {
  it("reads file contents", () => {
    const loaded = loadFiles(root, ["app.ts"]);
    expect(loaded[0]).toEqual({ path: "app.ts", content: "const a = 1;", isGitTracked: false });
  });
});
