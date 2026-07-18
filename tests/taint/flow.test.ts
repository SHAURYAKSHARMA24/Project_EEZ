import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/ast/analysis.ts";
import { unwrapExpression } from "../../src/ast/symbols.ts";
import ts from "../../src/ast/ts.ts";
import { findFlows } from "../../src/taint/flow.ts";
import { findSinks } from "../../src/taint/sinks.ts";
import { findSources } from "../../src/taint/sources.ts";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "flow");

function input(name: string) {
  return { path: name, content: readFileSync(join(fixtureRoot, name), "utf8") };
}

function analyze(name: string) {
  const project = analyzeProject([input(name)]);
  const file = project.files.get(name);
  if (!file) throw new Error(`Missing fixture ${name}.`);
  return { project, file };
}

function declaredSymbol(
  checker: import("typescript").TypeChecker,
  sourceFile: ts.SourceFile,
  name: string,
) {
  let symbol: import("typescript").Symbol | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      symbol = checker.getSymbolAtLocation(node.name);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return symbol;
}

describe("findFlows", () => {
  it("links direct bindings, origins, and exactly one const propagation hop", () => {
    const { project, file } = analyze("direct-and-one-hop.ts");
    const flows = findFlows(project.checker, file);

    expect(flows).toHaveLength(3);
    expect(flows.map((flow) => [flow.api, flow.sinkKind])).toEqual([
      ["vercel-generateText", "exec"],
      ["vercel-generateText", "eval"],
      ["vercel-generateText", "execSync"],
    ]);
    expect(flows.every((flow) => flow.sourceLine < flow.sinkLine)).toBe(true);
  });

  it("normalizes await and parentheses and preserves direct-origin identity", () => {
    const { project, file } = analyze("normalization.ts");
    const sources = findSources(project.checker, file);
    const sinks = findSinks(project.checker, file);
    const directArgument = unwrapExpression(sinks[0].argument);
    const directOrigin = sources.origins.find((origin) => origin.expression === directArgument);

    expect(directOrigin).toBeDefined();
    expect(directOrigin!.provenance.sourcePosition).toBeGreaterThan(
      directArgument.getStart(file.sourceFile),
    );
    const flows = findFlows(project.checker, file);
    expect(flows).toHaveLength(2);
    expect(flows[0].sourceLine).toBe(flows[0].sinkLine);
    expect(flows.map((flow) => flow.sinkKind)).toEqual(["exec", "exec"]);
  });

  it("normalizes compiler-erased TypeScript wrappers on sources and sink arguments", () => {
    const { project, file } = analyze("ts-erased-wrappers.ts");
    const flows = findFlows(project.checker, file);

    expect(flows).toHaveLength(5);
    expect(flows.every((flow) => flow.api === "vercel-generateText")).toBe(true);
    expect(flows.every((flow) => flow.sinkKind === "exec")).toBe(true);
    expect(flows.every((flow) => flow.sourceLine < flow.sinkLine)).toBe(true);
  });

  it("detects model output interpolated directly into a sink template literal", () => {
    const { project, file } = analyze("template-interpolation.ts");
    const flows = findFlows(project.checker, file);

    expect(flows).toHaveLength(2);
    expect(flows.every((flow) => flow.api === "vercel-generateText" && flow.sinkKind === "exec")).toBe(true);
    expect(flows.every((flow) => flow.sourceLine < flow.sinkLine)).toBe(true);
  });

  it("rejects backward flow using AST character positions", () => {
    const { project, file } = analyze("ordering.ts");
    expect(findFlows(project.checker, file)).toEqual([]);
  });

  it("does not cross nested or sibling lexical owners", () => {
    const { project, file } = analyze("function-boundaries.ts");
    expect(findFlows(project.checker, file)).toEqual([]);
  });

  it("does not link same-spelled symbols across supplied files", () => {
    const project = analyzeProject([
      input("project-isolation-source.ts"),
      input("project-isolation-sink.ts"),
    ]);
    const source = project.files.get("project-isolation-source.ts")?.sourceFile;
    const sink = project.files.get("project-isolation-sink.ts")?.sourceFile;
    if (!source || !sink) throw new Error("Missing project isolation fixtures.");

    expect(ts.isExternalModule(source)).toBe(true);
    expect(ts.isExternalModule(sink)).toBe(true);
    expect(declaredSymbol(project.checker, source, "text")).not.toBe(
      declaredSymbol(project.checker, sink, "text"),
    );
    expect(findFlows(project.checker, project.files.get("project-isolation-sink.ts")!)).toEqual([]);
  });
});
