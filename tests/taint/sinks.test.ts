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
      "spawn-shell",
    ]);
    expect(found.every((sink) => sink.line > 0)).toBe(true);
    const bodySinks = found.filter((sink) => sink.kind !== "spawn-shell");
    expect(bodySinks.every((sink) => ts.isIdentifier(sink.argument) && sink.argument.text === "body")).toBe(true);
    const constructed = found.filter((sink) => sink.kind === "function-constructor").at(-1);
    expect(constructed && ts.isNewExpression(constructed.call)).toBe(true);
    expect(constructed?.call.arguments).toHaveLength(2);
    expect(constructed?.argument).toBe(constructed?.call.arguments?.[1]);
  });

  it("rejects genuine local shadows and similar non-sinks", () => {
    expect(sinks("negatives.ts")).toEqual([]);
  });

  it("flags spawn only when shell:true is present", () => {
    const found = sinks("positives.ts");
    expect(found.some((sink) => sink.kind === "spawn-shell")).toBe(true);

    const nFound = sinks("negatives.ts");
    expect(nFound.some((sink) => sink.kind === "spawn-shell")).toBe(false);
  });
});
