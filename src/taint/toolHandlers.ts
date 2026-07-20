import { isImportedAs, unwrapExpression } from "../ast/symbols.ts";
import ts from "../ast/ts.ts";
import type {
  CallExpression,
  Expression,
  FunctionLikeDeclaration,
  ObjectLiteralExpression,
  TypeChecker,
} from "typescript";

export type ToolHandlerApi = "vercel-tool" | "mcp-tool";

export interface ToolHandler {
  api: ToolHandlerApi;
  handler: FunctionLikeDeclaration;
  parameterIndex: number;
}

const MCP_MODULE_PREFIX = "@modelcontextprotocol/sdk";

function asFunction(expression: Expression | undefined): FunctionLikeDeclaration | null {
  if (!expression) return null;
  const normalized = unwrapExpression(expression);
  return ts.isArrowFunction(normalized) || ts.isFunctionExpression(normalized)
    ? normalized
    : null;
}

function executeProperty(object: ObjectLiteralExpression): Expression | undefined {
  for (const property of object.properties) {
    if (
      ts.isPropertyAssignment(property)
      && ts.isIdentifier(property.name)
      && property.name.text === "execute"
    ) {
      return property.initializer;
    }
  }
  return undefined;
}

function vercelTool(checker: TypeChecker, call: CallExpression): ToolHandler | null {
  const callee = unwrapExpression(call.expression);
  if (!ts.isIdentifier(callee) || !isImportedAs(checker, callee, "ai", "tool")) return null;
  const config = call.arguments[0] ? unwrapExpression(call.arguments[0]) : undefined;
  if (!config || !ts.isObjectLiteralExpression(config)) return null;
  const handler = asFunction(executeProperty(config));
  return handler ? { api: "vercel-tool", handler, parameterIndex: 0 } : null;
}

// True when `expression` is `new <Ctor>()` where <Ctor> is imported from an
// @modelcontextprotocol/sdk subpath. Symbol identity via the import declaration
// keeps this precise against a locally-declared `McpServer`.
function isMcpServerConstruction(checker: TypeChecker, expression: Expression): boolean {
  const normalized = unwrapExpression(expression);
  if (!ts.isNewExpression(normalized)) return false;
  const ctor = unwrapExpression(normalized.expression);
  if (!ts.isIdentifier(ctor)) return false;
  const symbol = checker.getSymbolAtLocation(ctor);
  for (const declaration of symbol?.declarations ?? []) {
    if (!ts.isImportSpecifier(declaration) && !ts.isImportClause(declaration)) continue;
    let current: ts.Node | undefined = declaration;
    while (current && !ts.isImportDeclaration(current)) current = current.parent;
    if (
      current
      && ts.isImportDeclaration(current)
      && ts.isStringLiteral(current.moduleSpecifier)
      && current.moduleSpecifier.text.startsWith(MCP_MODULE_PREFIX)
    ) {
      return true;
    }
  }
  return false;
}

function mcpTool(checker: TypeChecker, call: CallExpression): ToolHandler | null {
  const callee = unwrapExpression(call.expression);

  // Bare `registerTool(...)` imported directly from the MCP SDK.
  if (ts.isIdentifier(callee) && isImportedAs(checker, callee, `${MCP_MODULE_PREFIX}/server/mcp.js`, "registerTool")) {
    const handler = asFunction(call.arguments.at(-1));
    return handler ? { api: "mcp-tool", handler, parameterIndex: 0 } : null;
  }

  // `<mcpServer>.registerTool(...)` or `<mcpServer>.tool(...)`.
  if (
    ts.isPropertyAccessExpression(callee)
    && (callee.name.text === "registerTool" || callee.name.text === "tool")
    && isMcpServerConstruction(checker, resolveReceiverConstruction(checker, callee.expression))
  ) {
    const handler = asFunction(call.arguments.at(-1));
    return handler ? { api: "mcp-tool", handler, parameterIndex: 0 } : null;
  }
  return null;
}

// Resolve `server` back to its `new McpServer(...)` initializer when `server`
// is a const bound to that construction; otherwise return the node unchanged so
// `isMcpServerConstruction` can also accept an inline `new McpServer().tool()`.
function resolveReceiverConstruction(checker: TypeChecker, receiver: Expression): Expression {
  const normalized = unwrapExpression(receiver);
  if (!ts.isIdentifier(normalized)) return normalized;
  const symbol = checker.getSymbolAtLocation(normalized);
  for (const declaration of symbol?.declarations ?? []) {
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      return unwrapExpression(declaration.initializer);
    }
  }
  return normalized;
}

export function findToolHandler(checker: TypeChecker, call: CallExpression): ToolHandler | null {
  return vercelTool(checker, call) ?? mcpTool(checker, call);
}
