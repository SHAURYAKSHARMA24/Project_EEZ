import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/ast/analysis.ts";
import ts from "../../src/ast/ts.ts";
import { findSources } from "../../src/taint/sources.ts";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "sources");

function analyze(name: string) {
  const project = analyzeProject([{
    path: name,
    content: readFileSync(join(fixtureRoot, name), "utf8"),
  }]);
  const file = project.files.get(name);
  if (!file) throw new Error(`Missing fixture ${name}.`);
  return { project, file };
}

function callsNamed(sourceFile: ts.SourceFile, name: string): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && ((ts.isIdentifier(node.expression) && node.expression.text === name)
        || (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === name))
    ) {
      calls.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return calls.sort((a, b) => a.getStart(sourceFile) - b.getStart(sourceFile));
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

describe("findSources", () => {
  it("discovers Vercel bindings and origins with producing-call provenance", () => {
    const { project, file } = analyze("vercel.ts");
    const found = findSources(project.checker, file);
    const calls = callsNamed(file.sourceFile, "generateText");

    expect(calls).toHaveLength(4);
    expect(found.bindings.map((binding) => binding.symbol.name)).toEqual(["text", "output"]);
    expect(found.origins).toHaveLength(2);
    const provenances = [...found.bindings, ...found.origins]
      .map((fact) => fact.provenance)
      .sort((a, b) => a.sourcePosition - b.sourcePosition);
    expect(provenances.map((provenance) => provenance.api)).toEqual([
      "vercel-generateText",
      "vercel-generateText",
      "vercel-generateText",
      "vercel-generateText",
    ]);
    expect(provenances.map((provenance) => provenance.sourceNode)).toEqual(calls);
    expect(provenances.map((provenance) => provenance.sourcePosition)).toEqual(
      calls.map((call) => call.getStart(file.sourceFile)),
    );
    expect(provenances.map((provenance) => provenance.sourceLine)).toEqual(
      calls.map((call) => lineOf(file.sourceFile, call)),
    );

    const resultOrigin = found.origins.find((origin) =>
      ts.isPropertyAccessExpression(origin.expression)
      && ts.isIdentifier(origin.expression.expression)
      && origin.expression.expression.text === "result",
    );
    expect(resultOrigin?.provenance.sourceLine).toBe(lineOf(file.sourceFile, calls[2]));
    expect(resultOrigin?.provenance.sourceLine).toBeLessThan(lineOf(file.sourceFile, resultOrigin!.expression));
  });

  it("discovers OpenAI output_text with responses.create provenance", () => {
    const { project, file } = analyze("openai.ts");
    const found = findSources(project.checker, file);
    const calls = callsNamed(file.sourceFile, "create");

    expect(calls).toHaveLength(2);
    expect(found.bindings).toEqual([]);
    expect(found.origins).toHaveLength(2);
    expect(found.origins.map((origin) => origin.provenance.api)).toEqual([
      "openai-responses",
      "openai-responses",
    ]);
    expect(found.origins.map((origin) => origin.provenance.sourceNode)).toEqual(calls);
    expect(found.origins.map((origin) => origin.provenance.sourcePosition)).toEqual(
      calls.map((call) => call.getStart(file.sourceFile)),
    );
    expect(found.origins.map((origin) => origin.provenance.sourceLine)).toEqual(
      calls.map((call) => lineOf(file.sourceFile, call)),
    );
  });

  it("ignores shadowed SDK names, parameter results, and unrelated properties", () => {
    const { project, file } = analyze("negatives.ts");

    expect(findSources(project.checker, file)).toEqual({ origins: [], bindings: [] });
  });

  it("marks recognized tool-handler parameters as tainted bindings", () => {
    const { project, file } = analyze("tool-parameters.ts");
    const found = findSources(project.checker, file);
    const names = found.bindings
      .filter((binding) => binding.provenance.api === "tool-parameter")
      .map((binding) => binding.symbol.name)
      .sort();
    expect(names).toEqual(["args", "command"]);
  });

  it("emits no tool-parameter bindings for a locally-declared tool/registerTool", () => {
    const { project, file } = analyze("tool-parameters-negative.ts");
    const found = findSources(project.checker, file);
    expect(found.bindings.filter((binding) => binding.provenance.api === "tool-parameter")).toEqual([]);
  });
});
