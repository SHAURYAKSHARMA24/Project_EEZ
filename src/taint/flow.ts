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

interface PropagatedBinding {
  source: SourceProvenance;
  position: number;
}

function isConstDeclaration(declaration: VariableDeclaration): boolean {
  return ts.isVariableDeclarationList(declaration.parent)
    && (declaration.parent.flags & ts.NodeFlags.Const) !== 0;
}

function identifierSymbol(checker: TypeChecker, expression: Expression): Symbol | undefined {
  return ts.isIdentifier(expression) ? checker.getSymbolAtLocation(expression) : undefined;
}

// Flatten a string-concatenation tree (`a + b + c`) into its leaf operands so
// taint on any leaf taints the whole concatenation. Only `+` is a propagator;
// any other binary operator returns the node itself (opaque, non-propagating).
function concatOperands(expression: Expression): Expression[] {
  const normalized = unwrapExpression(expression);
  if (
    ts.isBinaryExpression(normalized)
    && normalized.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    return [
      ...concatOperands(normalized.left),
      ...concatOperands(normalized.right),
    ];
  }
  return [normalized];
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

  const oneHopBindings = new Map<Symbol, PropagatedBinding>();
  const visit = (node: import("typescript").Node): void => {
    if (
      ts.isVariableDeclaration(node)
      && isConstDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer);
      let source: SourceProvenance | undefined;
      for (const leaf of concatOperands(initializer)) {
        source = originMap.get(leaf);
        if (!source) {
          const leafSymbol = identifierSymbol(checker, leaf);
          if (leafSymbol) source = directBindings.get(leafSymbol);
        }
        if (
          !source
          && (ts.isPropertyAccessExpression(leaf) || ts.isElementAccessExpression(leaf))
        ) {
          const receiver = unwrapExpression(leaf.expression);
          const receiverSymbol = identifierSymbol(checker, receiver);
          const receiverSource = receiverSymbol ? directBindings.get(receiverSymbol) : undefined;
          if (receiverSource?.api === "tool-parameter") source = receiverSource;
        }
        if (source) break;
      }
      if (source && source.owner === nearestOwner(node)) {
        const bindingSymbol = checker.getSymbolAtLocation(node.name);
        if (bindingSymbol) {
          oneHopBindings.set(bindingSymbol, {
            source,
            position: node.getStart(file.sourceFile),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file.sourceFile);

  const resolveDirectSource = (
    expression: Expression,
  ): { source: SourceProvenance; directOrigin: boolean; position: number } | null => {
    const normalized = unwrapExpression(expression);
    const origin = originMap.get(normalized);
    if (origin) return { source: origin, directOrigin: true, position: origin.sourcePosition };
    const symbol = identifierSymbol(checker, normalized);
    if (symbol) {
      const direct = directBindings.get(symbol);
      if (direct) {
        return { source: direct, directOrigin: false, position: direct.sourcePosition };
      }
      const propagated = oneHopBindings.get(symbol);
      if (propagated) {
        return {
          source: propagated.source,
          directOrigin: false,
          position: propagated.position,
        };
      }
    }
    if (ts.isPropertyAccessExpression(normalized) || ts.isElementAccessExpression(normalized)) {
      const receiver = unwrapExpression(normalized.expression);
      const receiverSymbol = identifierSymbol(checker, receiver);
      if (receiverSymbol) {
        const bound = directBindings.get(receiverSymbol);
        if (bound && bound.api === "tool-parameter") {
          return { source: bound, directOrigin: false, position: bound.sourcePosition };
        }
      }
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
      ? argument.templateSpans.flatMap((span) => concatOperands(span.expression))
      : concatOperands(argument);
    for (const operand of operands) {
      const resolved = resolveDirectSource(operand);
      if (!resolved || resolved.source.owner !== sink.owner) continue;
      if (
        !resolved.directOrigin
        && resolved.position > unwrapExpression(operand).getStart(file.sourceFile)
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
