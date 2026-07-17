import { redactKnownSecrets } from "../redact.ts";
import type { Finding, RuleError, Suppression } from "../types.ts";

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
  return JSON.stringify(
    {
      findings,
      errors,
      suppressed: safeSuppressions,
      summary: { check, audit, suppressed: safeSuppressions.length, total: findings.length },
    },
    null,
    2,
  );
}
