import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/ast/analysis.ts";
import ts from "../../src/ast/ts.ts";
import { findSinks } from "../../src/taint/sinks.ts";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "sinks");

function sinks(name: string) {
  const project = analyzeProject([{
    path: name,
    content: readFileSync(join(fixtureRoot, name), "utf8"),
  }]);
  const file = project.files.get(name);
  if (!file) throw new Error(`Missing fixture ${name}.`);
  return findSinks(project.checker, file);
}

describe("findSinks", () => {
  it("discovers only resolved child-process and unshadowed evaluator sinks", () => {
    const found = sinks("positives.ts");

    expect(found.map((sink) => sink.kind)).toEqual([
      "exec",
      "execSync",
      "exec",
      "execSync",
      "eval",
      "function-constructor",
      "function-constructor",
    ]);
    expect(found.every((sink) => sink.line > 0)).toBe(true);
    expect(found.every((sink) => ts.isIdentifier(sink.argument) && sink.argument.text === "body")).toBe(true);
    const constructed = found.at(-1);
    expect(constructed && ts.isNewExpression(constructed.call)).toBe(true);
    expect(constructed?.call.arguments).toHaveLength(2);
    expect(constructed?.argument).toBe(constructed?.call.arguments?.[1]);
  });

  it("rejects genuine local shadows and similar non-sinks", () => {
    expect(sinks("negatives.ts")).toEqual([]);
  });
});
