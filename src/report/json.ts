import { redactKnownSecrets } from "../redact.ts";
import type { Finding, RuleError, Suppression } from "../types.ts";
import { JSON_SCHEMA_VERSION, type JsonReportV1 } from "./jsonSchema.ts";

function redactSuppression(suppression: Suppression): Suppression {
  return {
    ruleId: redactKnownSecrets(suppression.ruleId),
    file: redactKnownSecrets(suppression.file),
    line: suppression.line,
    directiveLine: suppression.directiveLine,
    reason: redactKnownSecrets(suppression.reason),
  };
}

export function renderJson(
  findings: Finding[],
  errors: RuleError[] = [],
  suppressed: Suppression[] = [],
): string {
  const check = findings.filter((f) => f.tier === "check").length;
  const audit = findings.filter((f) => f.tier === "audit").length;
  const safeSuppressions = suppressed.map(redactSuppression);
  const report: JsonReportV1 = {
    schemaVersion: JSON_SCHEMA_VERSION,
    findings,
    errors,
    suppressed: safeSuppressions,
    summary: { check, audit, suppressed: safeSuppressions.length, total: findings.length },
  };
  return JSON.stringify(
    report,
    null,
    2,
  );
}
