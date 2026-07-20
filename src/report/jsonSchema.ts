import type { Finding, RuleError, Suppression } from "../types.ts";

export const JSON_SCHEMA_VERSION = 1 as const;

export interface JsonSummaryV1 {
  check: number;
  audit: number;
  suppressed: number;
  total: number;
}

export interface JsonReportV1 {
  schemaVersion: typeof JSON_SCHEMA_VERSION;
  scanComplete: boolean;
  findings: Finding[];
  errors: RuleError[];
  suppressed: Suppression[];
  summary: JsonSummaryV1;
}
