import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/ast/analysis.ts";
import { llmOutputToShell } from "../../src/rules/llmOutputToShell.ts";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "negatives");
const expectedFixtures = [
  "backward-flow.ts",
  "captured-value.ts",
  "exec-file.ts",
  "http-response.ts",
  "jsx-render.tsx",
  "local-generate-text.ts",
  "local-openai.ts",
  "logging.ts",
  "next-route.ts",
  "parameter-properties.ts",
  "reassigned-let.ts",
  "second-hop.ts",
  "shadow-eval.ts",
  "shadow-exec-sync.ts",
  "shadow-exec.ts",
  "shadow-function.ts",
  "shadow-generate-text.ts",
  "shadow-namespace.ts",
  "sibling-function.ts",
  "static-eval.ts",
  "static-exec.ts",
  "static-function.ts",
  "template-without-model.ts",
  "unrelated-properties.ts",
] as const;

describe("M1a precision corpus", () => {
  it("contains exactly the 24 approved negative fixtures", () => {
    const actual = readdirSync(fixtureRoot)
      .filter((name) => /\.(?:cjs|js|jsx|mjs|ts|tsx)$/.test(name))
      .sort();
    expect(actual).toEqual([...expectedFixtures].sort());
    expect(actual).toHaveLength(24);
  });

  it.each(expectedFixtures)("emits no finding for %s", (name) => {
    const content = readFileSync(join(fixtureRoot, name), "utf8");
    const analysis = analyzeProject([{ path: name, content }]);
    expect(llmOutputToShell.run({
      filePath: name,
      content,
      isGitTracked: false,
      analysis,
    })).toEqual([]);
  });
});
