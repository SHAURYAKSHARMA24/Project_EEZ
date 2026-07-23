import type { FileAnalysis } from "../ast/analysis.ts";
import { isImportedAs, isUnshadowedGlobal, nearestOwner, unwrapExpression } from "../ast/symbols.ts";
import ts from "../ast/ts.ts";
import type { CallExpression, Expression, NewExpression, TypeChecker } from "typescript";
import type { SourceProvenance } from "./sources.ts";

export type SinkKind = "exec" | "execSync" | "eval" | "function-constructor" | "spawn-shell";

export interface Sink {
  call: CallExpression | NewExpression;
  kind: SinkKind;
  argument: Expression;
  line: number;
  owner: SourceProvenance["owner"];
}

const CHILD_PROCESS_MODULES = new Set(["child_process", "node:child_process"]);

function hasShellTrue(args: readonly Expression[]): boolean {
  for (const arg of args) {
    const normalized = unwrapExpression(arg);
    if (!ts.isObjectLiteralExpression(normalized)) continue;
    for (const property of normalized.properties) {
      if (
        ts.isPropertyAssignment(property)
        && ts.isIdentifier(property.name)
        && property.name.text === "shell"
        && unwrapExpression(property.initializer).kind === ts.SyntaxKind.TrueKeyword
      ) {
        return true;
      }
    }
  }
  return false;
}

export function findSinks(checker: TypeChecker, file: FileAnalysis): Sink[] {
  const sinks: Sink[] = [];
  const { sourceFile } = file;

  const add = (
    call: CallExpression | NewExpression,
    kind: SinkKind,
    argument: Expression | undefined,
  ): void => {
    if (!argument) return;
    sinks.push({
      call,
      kind,
      argument,
      line: sourceFile.getLineAndCharacterOfPosition(call.getStart(sourceFile)).line + 1,
      owner: nearestOwner(call),
    });
  };

  const visit = (node: import("typescript").Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = unwrapExpression(node.expression);
      if (ts.isIdentifier(callee)) {
        if (isImportedAs(checker, callee, CHILD_PROCESS_MODULES, "exec")) {
          add(node, "exec", node.arguments[0]);
        } else if (isImportedAs(checker, callee, CHILD_PROCESS_MODULES, "execSync")) {
          add(node, "execSync", node.arguments[0]);
        } else if (
          isImportedAs(checker, callee, CHILD_PROCESS_MODULES, "spawn")
          && hasShellTrue(node.arguments)
        ) {
          add(node, "spawn-shell", node.arguments[0]);
        } else if (isUnshadowedGlobal(checker, callee, "eval")) {
          add(node, "eval", node.arguments[0]);
        } else if (isUnshadowedGlobal(checker, callee, "Function")) {
          add(node, "function-constructor", node.arguments.at(-1));
        }
      } else if (ts.isPropertyAccessExpression(callee)) {
        const namespace = unwrapExpression(callee.expression);
        if (ts.isIdentifier(namespace) && isImportedAs(checker, namespace, CHILD_PROCESS_MODULES, "*")) {
          if (callee.name.text === "exec") add(node, "exec", node.arguments[0]);
          if (callee.name.text === "execSync") add(node, "execSync", node.arguments[0]);
          if (callee.name.text === "spawn" && hasShellTrue(node.arguments)) {
            add(node, "spawn-shell", node.arguments[0]);
          }
        }
      }
    } else if (ts.isNewExpression(node)) {
      const constructor = unwrapExpression(node.expression);
      if (ts.isIdentifier(constructor) && isUnshadowedGlobal(checker, constructor, "Function")) {
        add(node, "function-constructor", node.arguments?.at(-1));
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return sinks;
}
