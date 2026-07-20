import { importedIdentity, isImportedAs, unwrapExpression } from "../ast/symbols.ts";
import ts from "../ast/ts.ts";
import type {
  CallExpression,
  Expression,
  FunctionLikeDeclaration,
  Identifier,
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

// Family match: the MCP SDK's own subpath exports (e.g. `.../server/mcp.js`)
// and any other module specifier under the `@modelcontextprotocol/sdk` package.
function isMcpModule(module: string): boolean {
  return module === MCP_MODULE_PREFIX || module.startsWith(`${MCP_MODULE_PREFIX}/`);
}

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
  if (call.arguments.length !== 1) return null;
  const config = call.arguments[0] ? unwrapExpression(call.arguments[0]) : undefined;
  if (!config || !ts.isObjectLiteralExpression(config)) return null;
  const handler = asFunction(executeProperty(config));
  return handler ? { api: "vercel-tool", handler, parameterIndex: 0 } : null;
}

// True when `expression` is `new <Ctor>()` where <Ctor> is imported from the
// @modelcontextprotocol/sdk package family. Symbol identity via `importedIdentity`
// keeps this precise against a locally-declared `McpServer`.
function isMcpServerConstruction(checker: TypeChecker, expression: Expression): boolean {
  const normalized = unwrapExpression(expression);
  if (!ts.isNewExpression(normalized)) return false;
  const ctor = unwrapExpression(normalized.expression);
  if (!ts.isIdentifier(ctor)) return false;
  const identity = importedIdentity(checker, ctor);
  return identity !== null
    && (identity.imported === "McpServer" || identity.imported === "Server")
    && isMcpModule(identity.module);
}

// True when `identifier` is imported as `registerTool` from the MCP SDK's
// dedicated subpath or any other module in the `@modelcontextprotocol/sdk`
// package family (matches the family matching already used for the receiver
// branch below).
function isMcpRegisterToolImport(checker: TypeChecker, identifier: Identifier): boolean {
  const identity = importedIdentity(checker, identifier);
  return identity !== null && identity.imported === "registerTool" && isMcpModule(identity.module);
}

function mcpTool(checker: TypeChecker, call: CallExpression): ToolHandler | null {
  const callee = unwrapExpression(call.expression);

  // Bare `registerTool(...)` imported directly from the MCP SDK family.
  if (ts.isIdentifier(callee) && isMcpRegisterToolImport(checker, callee)) {
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

// Resolve `server` back to its `new McpServer(...)` initializer only when
// `server` is bound by a `const` declaration to that construction. A `let`/`var`
// binding could have been reassigned between its declaration and the call site,
// so we deliberately do not follow those and instead return the node unchanged,
// letting `isMcpServerConstruction` (and ultimately the caller) resolve to
// `null`. Returning the node unchanged also lets `isMcpServerConstruction`
// accept an inline `new McpServer().tool()` receiver directly.
function resolveReceiverConstruction(checker: TypeChecker, receiver: Expression): Expression {
  const normalized = unwrapExpression(receiver);
  if (!ts.isIdentifier(normalized)) return normalized;
  const symbol = checker.getSymbolAtLocation(normalized);
  for (const declaration of symbol?.declarations ?? []) {
    if (
      ts.isVariableDeclaration(declaration)
      && declaration.initializer
      && ts.isVariableDeclarationList(declaration.parent)
      && (declaration.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      return unwrapExpression(declaration.initializer);
    }
  }
  return normalized;
}

export function findToolHandler(checker: TypeChecker, call: CallExpression): ToolHandler | null {
  return vercelTool(checker, call) ?? mcpTool(checker, call);
}
