import type { ProjectAnalysis } from "./ast/analysis.ts";

export type Tier = "check" | "audit";
export type Confidence = "high" | "medium" | "low";

export interface Finding {
  ruleId: string;
  tier: Tier;
  title: string;
  file: string;
  line: number;
  column?: number;
  confidence: Confidence;
  message: string;
  fix: string;
  source?: string;
  sink?: string;
  masked?: boolean;
}

export interface LoadedFile {
  path: string;
  content: string;
  isGitTracked: boolean;
}

export interface RuleContext {
  filePath: string;
  content: string;
  isGitTracked: boolean;
  analysis?: ProjectAnalysis;
}

export interface Rule {
  id: string;
  tier: Tier;
  appliesTo(filePath: string): boolean;
  run(ctx: RuleContext): Finding[];
}

export interface EngineResult {
  findings: Finding[];
  checkFailures: Finding[];
  errors: RuleError[];
  suppressed: Suppression[];
}

export interface RuleError {
  ruleId: string;
  file: string;
  message: string;
}

export interface Suppression {
  ruleId: string;
  file: string;
  line: number;
  directiveLine: number;
  reason: string;
}
