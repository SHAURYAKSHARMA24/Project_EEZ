import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/ast/analysis.ts";
import ts from "../../src/ast/ts.ts";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "analysis");

function input(name: string): { path: string; content: string } {
  return { path: name, content: readFileSync(join(fixtureRoot, name), "utf8") };
}

function declarationIdentifier(sourceFile: ts.SourceFile): ts.Identifier {
  const statement = sourceFile.statements.find(ts.isVariableStatement);
  const name = statement?.declarationList.declarations[0]?.name;
  if (!name || !ts.isIdentifier(name)) throw new Error("Expected an identifier declaration.");
  return name;
}

describe("analyzeProject", () => {
  it("forces ordinary supplied files into isolated module scopes", () => {
    const project = analyzeProject([
      input("ordinary-a.ts"),
      input("ordinary-b.ts"),
      input("module.ts"),
    ]);
    const ordinaryA = project.files.get("ordinary-a.ts")?.sourceFile;
    const ordinaryB = project.files.get("ordinary-b.ts")?.sourceFile;
    if (!ordinaryA || !ordinaryB) throw new Error("Expected both ordinary fixtures.");

    expect(ts.isExternalModule(ordinaryA)).toBe(true);
    expect(ts.isExternalModule(ordinaryB)).toBe(true);

    const symbolA = project.checker.getSymbolAtLocation(declarationIdentifier(ordinaryA));
    const symbolB = project.checker.getSymbolAtLocation(declarationIdentifier(ordinaryB));
    expect(symbolA).toBeDefined();
    expect(symbolB).toBeDefined();
    expect(symbolA).not.toBe(symbolB);

    const ordinaryDiagnostics = [
      ...project.checker.getDiagnostics(ordinaryA),
      ...project.checker.getDiagnostics(ordinaryB),
    ];
    expect(ordinaryDiagnostics).toEqual([]);
    expect(ordinaryDiagnostics.some((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n").includes("sameName"),
    )).toBe(false);
  });

  it("keeps the program limited to supplied in-memory code", () => {
    const project = analyzeProject([input("module.ts")]);

    expect(project.files.has("module.ts")).toBe(true);
    expect([...project.files.keys()]).toEqual(["module.ts"]);
    expect(project.files.get("module.ts")?.sourceFile.fileName).toBe("module.ts");
  });

  it("filters non-code input", () => {
    const project = analyzeProject([
      { path: "README.md", content: "not code" },
      input("ordinary-a.ts"),
    ]);

    expect(project.files.has("README.md")).toBe(false);
    expect(project.files.has("ordinary-a.ts")).toBe(true);
  });
});
