import type { FileAnalysis } from "../ast/analysis.ts";
import { nearestOwner, unwrapExpression } from "../ast/symbols.ts";
import ts from "../ast/ts.ts";
import type { Expression, Symbol, TypeChecker, VariableDeclaration } from "typescript";
import { findSinks, type SinkKind } from "./sinks.ts";
import { findSources, type SourceApi, type SourceProvenance } from "./sources.ts";

export interface TaintFlow {
  api: SourceApi;
  sinkKind: SinkKind;
  sourceLine: number;
  sinkLine: number;
}

function isConstDeclaration(declaration: VariableDeclaration): boolean {
  return ts.isVariableDeclarationList(declaration.parent)
    && (declaration.parent.flags & ts.NodeFlags.Const) !== 0;
}

function identifierSymbol(checker: TypeChecker, expression: Expression): Symbol | undefined {
  return ts.isIdentifier(expression) ? checker.getSymbolAtLocation(expression) : undefined;
}

export function findFlows(checker: TypeChecker, file: FileAnalysis): TaintFlow[] {
  const sources = findSources(checker, file);
  const originMap = new Map<Expression, SourceProvenance>();
  for (const origin of sources.origins) {
    originMap.set(unwrapExpression(origin.expression), origin.provenance);
  }
  const directBindings = new Map<Symbol, SourceProvenance>();
  for (const binding of sources.bindings) {
    directBindings.set(binding.symbol, binding.provenance);
  }

  const oneHopBindings = new Map<Symbol, SourceProvenance>();
  const visit = (node: import("typescript").Node): void => {
    if (
      ts.isVariableDeclaration(node)
      && isConstDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer);
      let source = originMap.get(initializer);
      if (!source) {
        const initializerSymbol = identifierSymbol(checker, initializer);
        if (initializerSymbol) source = directBindings.get(initializerSymbol);
      }
      if (source && source.owner === nearestOwner(node)) {
        const bindingSymbol = checker.getSymbolAtLocation(node.name);
        if (bindingSymbol) oneHopBindings.set(bindingSymbol, source);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file.sourceFile);

  const flows: TaintFlow[] = [];
  for (const sink of findSinks(checker, file)) {
    const argument = unwrapExpression(sink.argument);
    let source = originMap.get(argument);
    const directOrigin = source !== undefined;
    if (!source) {
      const argumentSymbol = identifierSymbol(checker, argument);
      if (argumentSymbol) {
        source = directBindings.get(argumentSymbol) ?? oneHopBindings.get(argumentSymbol);
      }
    }
    if (!source || source.owner !== sink.owner) continue;
    if (!directOrigin && source.sourcePosition > argument.getStart(file.sourceFile)) continue;
    flows.push({
      api: source.api,
      sinkKind: sink.kind,
      sourceLine: source.sourceLine,
      sinkLine: sink.line,
    });
  }
  return flows;
}
