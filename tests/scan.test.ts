import { describe, expect, it } from "vitest";
import { scanFiles } from "../src/scan.ts";
import type { ProjectAnalysis } from "../src/ast/analysis.ts";
import type { LoadedFile, Rule } from "../src/types.ts";

describe("scanFiles", () => {
  it("builds one shared analysis for an exact loaded-file set", () => {
    const files: LoadedFile[] = [
      { path: "a.ts", content: "const a = true;", isGitTracked: false },
      { path: "b.ts", content: "const b = true;", isGitTracked: false },
      { path: "notes.md", content: "not code", isGitTracked: false },
    ];
    const observed: ProjectAnalysis[] = [];
    const observer: Rule = {
      id: "observer",
      tier: "check",
      appliesTo: () => true,
      run: (context) => {
        if (!context.analysis) throw new Error("Missing shared analysis.");
        observed.push(context.analysis);
        return [];
      },
    };

    const result = scanFiles(files, [observer]);

    expect(result).toMatchObject({ findings: [], checkFailures: [], errors: [], suppressed: [] });
    expect(observed).toHaveLength(3);
    expect(new Set(observed)).toEqual(new Set([observed[0]]));
    expect([...observed[0].files.keys()]).toEqual(["a.ts", "b.ts"]);
    expect(Object.keys(files[0]).sort()).toEqual(["content", "isGitTracked", "path"]);
  });
});
