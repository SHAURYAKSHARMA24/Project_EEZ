import { runRules } from "./engine.ts";
import type { EngineResult, LoadedFile, Rule } from "./types.ts";
import { analyzeFiles } from "./walk.ts";

export function scanFiles(files: LoadedFile[], rules: Rule[]): EngineResult {
  const analysis = analyzeFiles(files);
  return runRules(files, rules, analysis);
}
