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

  const resolveDirectSource = (
    expression: Expression,
  ): { source: SourceProvenance; directOrigin: boolean } | null => {
    const normalized = unwrapExpression(expression);
    const origin = originMap.get(normalized);
    if (origin) return { source: origin, directOrigin: true };
    const symbol = identifierSymbol(checker, normalized);
    if (symbol) {
      const bound = directBindings.get(symbol) ?? oneHopBindings.get(symbol);
      if (bound) return { source: bound, directOrigin: false };
    }
    return null;
  };

  const flows: TaintFlow[] = [];
  for (const sink of findSinks(checker, file)) {
    const argument = unwrapExpression(sink.argument);
    // A shell/eval argument is tainted when it is the model output itself or
    // when it interpolates the model output directly into a template literal.
    // Both are single-owner flows; the interpolation adds no extra hop.
    const operands = ts.isTemplateExpression(argument)
      ? argument.templateSpans.map((span) => span.expression)
      : [argument];
    for (const operand of operands) {
      const resolved = resolveDirectSource(operand);
      if (!resolved || resolved.source.owner !== sink.owner) continue;
      if (
        !resolved.directOrigin
        && resolved.source.sourcePosition > unwrapExpression(operand).getStart(file.sourceFile)
      ) {
        continue;
      }
      flows.push({
        api: resolved.source.api,
        sinkKind: sink.kind,
        sourceLine: resolved.source.sourceLine,
        sinkLine: sink.line,
      });
      break;
    }
  }
  return flows;
}
