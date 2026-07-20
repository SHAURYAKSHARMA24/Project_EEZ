import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/ast/analysis.ts";
import ts from "../../src/ast/ts.ts";
import { findToolHandler } from "../../src/taint/toolHandlers.ts";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "toolHandlers");

function analyze(name: string) {
  const project = analyzeProject([{ path: name, content: readFileSync(join(fixtureRoot, name), "utf8") }]);
  const file = project.files.get(name);
  if (!file) throw new Error(`Missing fixture ${name}.`);
  return { project, file };
}

function firstCall(sourceFile: ts.SourceFile, calleeName: string): ts.CallExpression {
  let found: ts.CallExpression | undefined;
  const visit = (node: ts.Node): void => {
    if (!found && ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
      if (name === calleeName) found = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!found) throw new Error(`No call to ${calleeName}.`);
  return found;
}

describe("findToolHandler", () => {
  it("recognizes a Vercel AI SDK tool({ execute }) call", () => {
    const { project, file } = analyze("vercel-tool.ts");
    const handler = findToolHandler(project.checker, firstCall(file.sourceFile, "tool"));
    expect(handler?.api).toBe("vercel-tool");
    expect(handler?.parameterIndex).toBe(0);
    expect(handler && ts.isFunctionLike(handler.handler)).toBe(true);
  });

  it("recognizes an MCP registerTool handler", () => {
    const { project, file } = analyze("mcp-register.ts");
    const handler = findToolHandler(project.checker, firstCall(file.sourceFile, "registerTool"));
    expect(handler?.api).toBe("mcp-tool");
    expect(handler?.parameterIndex).toBe(0);
  });

  it("ignores same-named calls not imported from the modeled SDKs", () => {
    const { project, file } = analyze("negatives.ts");
    expect(findToolHandler(project.checker, firstCall(file.sourceFile, "tool"))).toBeNull();
    expect(findToolHandler(project.checker, firstCall(file.sourceFile, "registerTool"))).toBeNull();
  });

  it("rejects a receiver reassigned after a non-const declaration", () => {
    const { project, file } = analyze("mcp-reassigned-receiver.ts");
    expect(findToolHandler(project.checker, firstCall(file.sourceFile, "tool"))).toBeNull();
  });

  it("recognizes a bare registerTool import from the MCP SDK package family", () => {
    const { project, file } = analyze("mcp-bare-register-tool.ts");
    const handler = findToolHandler(project.checker, firstCall(file.sourceFile, "registerTool"));
    expect(handler?.api).toBe("mcp-tool");
    expect(handler?.parameterIndex).toBe(0);
    expect(handler && ts.isFunctionLike(handler.handler)).toBe(true);
  });

  it("ignores a same-named registerTool imported from an unrelated module", () => {
    const { project, file } = analyze("mcp-bare-register-tool-unrelated.ts");
    expect(findToolHandler(project.checker, firstCall(file.sourceFile, "registerTool"))).toBeNull();
  });
});
