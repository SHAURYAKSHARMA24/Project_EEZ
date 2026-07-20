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

function calls(sourceFile: ts.SourceFile, calleeName: string): ts.CallExpression[] {
  const found: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
      if (name === calleeName) found.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
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

  it("requires the exact MCP SDK package boundary", () => {
    for (const [fixture, callee] of [
      ["mcp-fake-prefix-constructor.ts", "registerTool"],
      ["mcp-fake-prefix-bare.ts", "registerTool"],
    ] as const) {
      const { project, file } = analyze(fixture);
      expect(findToolHandler(project.checker, firstCall(file.sourceFile, callee))).toBeNull();
    }
  });

  it("accepts only McpServer and Server constructors by imported identity", () => {
    const client = analyze("mcp-client.ts");
    expect(
      findToolHandler(client.project.checker, firstCall(client.file.sourceFile, "registerTool")),
    ).toBeNull();

    const aliased = analyze("mcp-aliased-constructors.ts");
    const handlers = [
      ...calls(aliased.file.sourceFile, "registerTool"),
      ...calls(aliased.file.sourceFile, "tool"),
    ].map((call) => findToolHandler(aliased.project.checker, call));
    expect(handlers).toHaveLength(2);
    expect(handlers.every((handler) => handler?.api === "mcp-tool")).toBe(true);
  });

  it("requires exactly one object-literal argument for a Vercel tool", () => {
    const { project, file } = analyze("vercel-extra-argument.ts");
    expect(findToolHandler(project.checker, firstCall(file.sourceFile, "tool"))).toBeNull();
  });

  // The MCP callback receives tool arguments as parameter 0 only when the
  // registration declares an input schema. Without one the SDK passes the
  // transport `extra` object, which is not model-controlled.
  it("ignores deprecated tool() registrations that declare no params schema", () => {
    const { project, file } = analyze("mcp-tool-no-schema.ts");
    const handlers = calls(file.sourceFile, "tool")
      .map((call) => findToolHandler(project.checker, call));
    expect(handlers).toHaveLength(3);
    expect(handlers.every((handler) => handler === null)).toBe(true);
  });

  it("recognizes deprecated tool() registrations that do declare a params schema", () => {
    const { project, file } = analyze("mcp-tool-schema.ts");
    const handlers = calls(file.sourceFile, "tool")
      .map((call) => findToolHandler(project.checker, call));
    expect(handlers).toHaveLength(2);
    expect(handlers.every((handler) => handler?.api === "mcp-tool")).toBe(true);
    expect(handlers.every((handler) => handler?.parameterIndex === 0)).toBe(true);
  });

  it("ignores a registerTool config without inputSchema", () => {
    const { project, file } = analyze("mcp-register-no-input-schema.ts");
    expect(
      findToolHandler(project.checker, firstCall(file.sourceFile, "registerTool")),
    ).toBeNull();
  });
});
