import type {
  Expression,
  FunctionLikeDeclaration,
  Identifier,
  ImportDeclaration,
  Node,
  SourceFile,
  TypeChecker,
} from "typescript";
import ts from "./ts.ts";

export interface ImportIdentity {
  module: string;
  imported: string | "*" | "default";
}

function containingImport(node: Node): ImportDeclaration | null {
  let current: Node | undefined = node;
  while (current) {
    if (ts.isImportDeclaration(current)) return current;
    if (ts.isSourceFile(current)) return null;
    current = current.parent;
  }
  return null;
}

export function importedIdentity(
  checker: TypeChecker,
  identifier: Identifier,
): ImportIdentity | null {
  const symbol = checker.getSymbolAtLocation(identifier);
  for (const declaration of symbol?.declarations ?? []) {
    let imported: ImportIdentity["imported"] | null = null;
    if (ts.isImportSpecifier(declaration)) {
      imported = (declaration.propertyName ?? declaration.name).text;
    } else if (ts.isImportClause(declaration) && declaration.name) {
      imported = "default";
    } else if (ts.isNamespaceImport(declaration)) {
      imported = "*";
    }
    if (imported === null) continue;

    const importDeclaration = containingImport(declaration);
    if (!importDeclaration || !ts.isStringLiteral(importDeclaration.moduleSpecifier)) continue;
    return { module: importDeclaration.moduleSpecifier.text, imported };
  }
  return null;
}

export function isImportedAs(
  checker: TypeChecker,
  identifier: Identifier,
  module: string | ReadonlySet<string>,
  imported: ImportIdentity["imported"],
): boolean {
  const identity = importedIdentity(checker, identifier);
  if (!identity || identity.imported !== imported) return false;
  return typeof module === "string"
    ? identity.module === module
    : module.has(identity.module);
}

export function isUnshadowedGlobal(
  checker: TypeChecker,
  identifier: Identifier,
  expectedName: "eval" | "Function",
): boolean {
  if (identifier.text !== expectedName) return false;
  const symbol = checker.getSymbolAtLocation(identifier);
  return !symbol || (symbol.declarations?.length ?? 0) === 0;
}

export function nearestOwner(node: Node): FunctionLikeDeclaration | SourceFile {
  let current: Node | undefined = node;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isFunctionLike(current)) return current as FunctionLikeDeclaration;
    current = current.parent;
  }
  return node.getSourceFile();
}

// Strip wrappers that expose the same runtime value as the expression they
// enclose, so taint on the inner expression is taint on the whole. This covers
// grouping parentheses, `await` (the awaited value is what propagates), and the
// compiler-erased TypeScript assertions `x as T`, `<T>x`, `x!`, and
// `x satisfies T`. Wrappers that can change the value at runtime (calls,
// property access, binary operators, ...) are deliberately left intact.
export function unwrapExpression(expression: Expression): Expression {
  let current = expression;
  while (
    ts.isAwaitExpression(current)
    || ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isNonNullExpression(current)
    || ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}
