import type { FileAnalysis } from "../ast/analysis.ts";
import { isImportedAs, nearestOwner, unwrapExpression } from "../ast/symbols.ts";
import ts from "../ast/ts.ts";
import { findToolHandler } from "./toolHandlers.ts";
import type {
  CallExpression,
  Expression,
  FunctionLikeDeclaration,
  SourceFile,
  Symbol,
  TypeChecker,
  VariableDeclaration,
} from "typescript";

export type SourceApi = "openai-responses" | "vercel-generateText" | "tool-parameter";

export interface SourceProvenance {
  api: SourceApi;
  sourceNode: Expression;
  sourceLine: number;
  sourcePosition: number;
  owner: FunctionLikeDeclaration | SourceFile;
}

export interface TaintOrigin {
  expression: Expression;
  provenance: SourceProvenance;
}

export interface TaintedBinding {
  symbol: Symbol;
  owner: SourceProvenance["owner"];
  provenance: SourceProvenance;
}

function isConstDeclaration(declaration: VariableDeclaration): boolean {
  return ts.isVariableDeclarationList(declaration.parent)
    && (declaration.parent.flags & ts.NodeFlags.Const) !== 0;
}

function symbolOf(checker: TypeChecker, expression: Expression): Symbol | undefined {
  return ts.isIdentifier(expression) ? checker.getSymbolAtLocation(expression) : undefined;
}

function provenance(
  api: SourceApi,
  call: CallExpression,
  sourceFile: SourceFile,
): SourceProvenance {
  const sourcePosition = call.getStart(sourceFile);
  return {
    api,
    sourceNode: call,
    sourceLine: sourceFile.getLineAndCharacterOfPosition(sourcePosition).line + 1,
    sourcePosition,
    owner: nearestOwner(call),
  };
}

function vercelCall(checker: TypeChecker, expression: Expression): CallExpression | null {
  const normalized = unwrapExpression(expression);
  if (!ts.isCallExpression(normalized)) return null;
  const callee = unwrapExpression(normalized.expression);
  return ts.isIdentifier(callee)
    && isImportedAs(checker, callee, "ai", "generateText")
    ? normalized
    : null;
}

function openAiClientConstructor(checker: TypeChecker, expression: Expression): boolean {
  const normalized = unwrapExpression(expression);
  if (!ts.isNewExpression(normalized)) return false;
  const constructor = unwrapExpression(normalized.expression);
  return ts.isIdentifier(constructor)
    && isImportedAs(checker, constructor, "openai", "default");
}

function openAiResponsesCall(
  checker: TypeChecker,
  expression: Expression,
  clients: ReadonlySet<Symbol>,
): CallExpression | null {
  const normalized = unwrapExpression(expression);
  if (!ts.isCallExpression(normalized)) return null;
  const callee = unwrapExpression(normalized.expression);
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== "create") return null;
  const responses = unwrapExpression(callee.expression);
  if (!ts.isPropertyAccessExpression(responses) || responses.name.text !== "responses") return null;
  const client = unwrapExpression(responses.expression);
  const clientSymbol = symbolOf(checker, client);
  // Membership in `clients` proves this exact symbol is a verified OpenAI client,
  // preserving shadowing precision without any name matching. Lexical scoping
  // guarantees the referenced declaration lives in an enclosing (module or
  // ancestor) scope, so the client may be a shared singleton while the tainted
  // output stays owned by this call's own lexical scope via `provenance`.
  return clientSymbol && clients.has(clientSymbol) ? normalized : null;
}

function destructuredTextBindings(
  checker: TypeChecker,
  declaration: VariableDeclaration,
  source: SourceProvenance,
): TaintedBinding[] {
  if (!ts.isObjectBindingPattern(declaration.name)) return [];
  const bindings: TaintedBinding[] = [];
  for (const element of declaration.name.elements) {
    if (element.dotDotDotToken || element.initializer || !ts.isIdentifier(element.name)) continue;
    const propertyName = element.propertyName ?? element.name;
    if ((!ts.isIdentifier(propertyName) && !ts.isStringLiteral(propertyName)) || propertyName.text !== "text") {
      continue;
    }
    const symbol = checker.getSymbolAtLocation(element.name);
    if (symbol) bindings.push({ symbol, owner: source.owner, provenance: source });
  }
  return bindings;
}

// Bind the model-controlled parameter of a recognized tool handler as tainted.
// The parameter may be a plain identifier or an object binding pattern; every
// bound identifier becomes a tainted binding owned by the handler function, so
// existing same-owner flow links it to sinks in the handler body.
function toolParameterBindings(
  checker: TypeChecker,
  call: CallExpression,
  sourceFile: SourceFile,
): TaintedBinding[] {
  const handlerInfo = findToolHandler(checker, call);
  if (!handlerInfo) return [];
  const parameter = handlerInfo.handler.parameters[handlerInfo.parameterIndex];
  if (!parameter) return [];

  const position = parameter.getStart(sourceFile);
  const source: SourceProvenance = {
    api: "tool-parameter",
    sourceNode: call,
    sourceLine: sourceFile.getLineAndCharacterOfPosition(call.getStart(sourceFile)).line + 1,
    sourcePosition: position,
    owner: handlerInfo.handler,
  };

  const bindings: TaintedBinding[] = [];
  const bind = (name: import("typescript").Node): void => {
    if (ts.isIdentifier(name)) {
      const symbol = checker.getSymbolAtLocation(name);
      if (symbol) bindings.push({ symbol, owner: source.owner, provenance: source });
    } else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) {
        if (ts.isBindingElement(element)) bind(element.name);
      }
    }
  };
  bind(parameter.name);
  return bindings;
}

export function findSources(
  checker: TypeChecker,
  file: FileAnalysis,
): { origins: TaintOrigin[]; bindings: TaintedBinding[] } {
  const origins: TaintOrigin[] = [];
  const bindings: TaintedBinding[] = [];
  const vercelResults = new Map<Symbol, SourceProvenance>();
  const openAiClients = new Set<Symbol>();
  const openAiResponses = new Map<Symbol, SourceProvenance>();
  const { sourceFile } = file;

  const visit = (node: import("typescript").Node): void => {
    if (ts.isVariableDeclaration(node) && isConstDeclaration(node) && node.initializer) {
      if (ts.isIdentifier(node.name) && openAiClientConstructor(checker, node.initializer)) {
        const symbol = checker.getSymbolAtLocation(node.name);
        if (symbol) openAiClients.add(symbol);
      }

      const generateCall = vercelCall(checker, node.initializer);
      if (generateCall) {
        const source = provenance("vercel-generateText", generateCall, sourceFile);
        if (ts.isIdentifier(node.name)) {
          const symbol = checker.getSymbolAtLocation(node.name);
          if (symbol) vercelResults.set(symbol, source);
        } else {
          bindings.push(...destructuredTextBindings(checker, node, source));
        }
      }

      const responsesCall = openAiResponsesCall(checker, node.initializer, openAiClients);
      if (responsesCall && ts.isIdentifier(node.name)) {
        const symbol = checker.getSymbolAtLocation(node.name);
        if (symbol) {
          openAiResponses.set(symbol, provenance("openai-responses", responsesCall, sourceFile));
        }
      }
    }

    if (ts.isPropertyAccessExpression(node)) {
      const receiver = unwrapExpression(node.expression);
      let source: SourceProvenance | undefined;
      if (node.name.text === "text") {
        const resultSymbol = symbolOf(checker, receiver);
        source = resultSymbol ? vercelResults.get(resultSymbol) : undefined;
        if (!source) {
          const call = vercelCall(checker, receiver);
          if (call) source = provenance("vercel-generateText", call, sourceFile);
        }
      } else if (node.name.text === "output_text") {
        const responseSymbol = symbolOf(checker, receiver);
        source = responseSymbol ? openAiResponses.get(responseSymbol) : undefined;
        if (!source) {
          const call = openAiResponsesCall(checker, receiver, openAiClients);
          if (call) source = provenance("openai-responses", call, sourceFile);
        }
      }
      if (source && source.owner === nearestOwner(node)) {
        origins.push({ expression: node, provenance: source });
      }
    }

    if (ts.isCallExpression(node)) {
      bindings.push(...toolParameterBindings(checker, node, sourceFile));
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { origins, bindings };
}
