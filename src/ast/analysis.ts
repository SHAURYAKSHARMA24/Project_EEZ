import type { CompilerHost, SourceFile, TypeChecker } from "typescript";
import ts from "./ts.ts";

export interface FileAnalysis {
  path: string;
  sourceFile: SourceFile;
}

export interface ProjectAnalysis {
  checker: TypeChecker;
  files: Map<string, FileAnalysis>;
}

const CODE_EXTENSION = /\.(?:cjs|js|jsx|mjs|ts|tsx)$/i;

function scriptKind(path: string): import("typescript").ScriptKind {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (lowerPath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (lowerPath.endsWith(".js") || lowerPath.endsWith(".mjs") || lowerPath.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

type MutableSourceFile = SourceFile & { externalModuleIndicator: import("typescript").Node | undefined };

const forceExternalModule = (file: SourceFile): void => {
  if (!file.isDeclarationFile) {
    (file as MutableSourceFile).externalModuleIndicator = file.endOfFileToken;
  }
};

export function analyzeProject(
  input: readonly { path: string; content: string }[],
): ProjectAnalysis {
  const contentByPath = new Map(
    input
      .filter(({ path }) => CODE_EXTENSION.test(path))
      .map(({ path, content }) => [path, content] as const),
  );
  const sourceFiles = new Map<string, SourceFile>();
  const options: import("typescript").CompilerOptions = {
    noLib: true,
    noResolve: true,
    allowJs: true,
    checkJs: false,
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    moduleDetection: ts.ModuleDetectionKind.Force,
    skipLibCheck: true,
  };

  const host: CompilerHost = {
    fileExists: (path) => contentByPath.has(path),
    readFile: (path) => contentByPath.get(path),
    getSourceFile: (path) => {
      const existing = sourceFiles.get(path);
      if (existing) return existing;
      const content = contentByPath.get(path);
      if (content === undefined) return undefined;
      const sourceFile = ts.createSourceFile(path, content, {
        languageVersion: ts.ScriptTarget.Latest,
        setExternalModuleIndicator: forceExternalModule,
      }, true, scriptKind(path));
      sourceFiles.set(path, sourceFile);
      return sourceFile;
    },
    getDefaultLibFileName: () => "lib.d.ts",
    writeFile: () => undefined,
    getCurrentDirectory: () => "",
    getDirectories: () => [],
    getCanonicalFileName: (path) => path,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };

  const program = ts.createProgram({
    rootNames: [...contentByPath.keys()],
    options,
    host,
  });
  const files = new Map<string, FileAnalysis>();
  for (const path of contentByPath.keys()) {
    const sourceFile = program.getSourceFile(path);
    if (sourceFile) files.set(path, { path, sourceFile });
  }

  return { checker: program.getTypeChecker(), files };
}
