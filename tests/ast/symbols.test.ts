import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/ast/analysis.ts";
import {
  importedIdentity,
  isImportedAs,
  isUnshadowedGlobal,
  nearestOwner,
  unwrapExpression,
} from "../../src/ast/symbols.ts";
import ts from "../../src/ast/ts.ts";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "symbols",
  "import-resolution.ts",
);
const content = readFileSync(fixturePath, "utf8");
const project = analyzeProject([{ path: "import-resolution.ts", content }]);
const sourceFile = project.files.get("import-resolution.ts")?.sourceFile;
if (!sourceFile) throw new Error("Expected symbols fixture.");

function variable(name: string): ts.VariableDeclaration {
  let match: ts.VariableDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      match = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!match) throw new Error(`Missing variable ${name}.`);
  return match;
}

function identifierInitializer(name: string): ts.Identifier {
  const initializer = variable(name).initializer;
  if (!initializer || !ts.isIdentifier(initializer)) {
    throw new Error(`Expected identifier initializer for ${name}.`);
  }
  return initializer;
}

function callWithText(text: string, callee: "eval" | "Function"): ts.Identifier {
  let match: ts.Identifier | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === callee
      && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === text
    ) {
      match = node.expression;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!match) throw new Error(`Missing ${callee}(${text}).`);
  return match;
}

describe("symbol helpers", () => {
  it("classifies original local import declarations at identifier uses", () => {
    expect(importedIdentity(project.checker, identifierInitializer("namedAliasUse"))).toEqual({
      module: "node:child_process",
      imported: "exec",
    });
    expect(importedIdentity(project.checker, identifierInitializer("defaultUse"))).toEqual({
      module: "openai",
      imported: "default",
    });
    expect(importedIdentity(project.checker, identifierInitializer("namespaceUse"))).toEqual({
      module: "node:child_process",
      imported: "*",
    });
    expect(isImportedAs(
      project.checker,
      identifierInitializer("namedSourceUse"),
      "ai",
      "generateText",
    )).toBe(true);
  });

  it("rejects genuine same-named local shadows", () => {
    for (const name of [
      "shadowNamedAliasUse",
      "shadowDefaultUse",
      "shadowNamespaceUse",
      "shadowNamedSourceUse",
    ]) {
      expect(importedIdentity(project.checker, identifierInitializer(name))).toBeNull();
    }
  });

  it("recognizes only unshadowed global eval and Function", () => {
    expect(isUnshadowedGlobal(project.checker, callWithText("global", "eval"), "eval")).toBe(true);
    expect(isUnshadowedGlobal(project.checker, callWithText("global", "Function"), "Function")).toBe(true);
    expect(isUnshadowedGlobal(project.checker, callWithText("shadowed", "eval"), "eval")).toBe(false);
    expect(isUnshadowedGlobal(project.checker, callWithText("shadowed", "Function"), "Function")).toBe(false);
  });

  it("finds the nearest lexical owner", () => {
    const outerUse = identifierInitializer("outerUse");
    const nestedUse = identifierInitializer("nestedUse");
    const topLevel = variable("topLevel");
    const outerOwner = nearestOwner(outerUse);
    const nestedOwner = nearestOwner(nestedUse);

    expect(ts.isFunctionDeclaration(outerOwner) && outerOwner.name?.text).toBe("outer");
    expect(ts.isArrowFunction(nestedOwner)).toBe(true);
    expect(nearestOwner(topLevel)).toBe(sourceFile);
  });

  it("unwraps only awaited and parenthesized expressions", () => {
    const initializer = variable("normalized").initializer;
    if (!initializer) throw new Error("Expected normalized initializer.");

    const unwrapped = unwrapExpression(initializer);
    expect(ts.isIdentifier(unwrapped) && unwrapped.text).toBe("value");
  });
});
