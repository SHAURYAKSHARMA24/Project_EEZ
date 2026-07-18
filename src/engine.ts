import { redactKnownSecrets } from "./redact.ts";
import { applySuppressions } from "./suppressions.ts";
import type { ProjectAnalysis } from "./ast/analysis.ts";
import type { EngineResult, Finding, LoadedFile, Rule, RuleError } from "./types.ts";

function redactFinding(finding: Finding): Finding {
  return {
    ruleId: redactKnownSecrets(finding.ruleId),
    tier: finding.tier,
    title: redactKnownSecrets(finding.title),
    file: redactKnownSecrets(finding.file),
    line: finding.line,
    ...(finding.column === undefined ? {} : { column: finding.column }),
    confidence: finding.confidence,
    message: redactKnownSecrets(finding.message),
    fix: redactKnownSecrets(finding.fix),
    ...(finding.source === undefined ? {} : { source: redactKnownSecrets(finding.source) }),
    ...(finding.sink === undefined ? {} : { sink: redactKnownSecrets(finding.sink) }),
    ...(finding.masked === undefined ? {} : { masked: finding.masked }),
  };
}

export function runRules(
  files: LoadedFile[],
  rules: Rule[],
  analysis?: ProjectAnalysis,
): EngineResult {
  const findings: Finding[] = [];
  const errors: RuleError[] = [];
  const suppressed: EngineResult["suppressed"] = [];
  const knownRuleIds = new Set(rules.map((rule) => rule.id));

  for (const file of files) {
    const fileFindings: Finding[] = [];
    for (const rule of rules) {
      const filePath = redactKnownSecrets(file.path);
      try {
        if (!rule.appliesTo(file.path)) continue;
        fileFindings.push(
          ...rule.run({
            filePath,
            content: file.content,
            isGitTracked: file.isGitTracked,
            analysis,
          }).map(redactFinding),
        );
      } catch {
        errors.push({
          ruleId: redactKnownSecrets(rule.id),
          file: filePath,
          message: "Rule could not scan this file.",
        });
      }
    }

    const suppressionResult = applySuppressions(file.path, file.content, knownRuleIds, fileFindings);
    findings.push(...suppressionResult.findings);
    suppressed.push(...suppressionResult.suppressed);
    errors.push(...suppressionResult.errors);
  }
  return { findings, checkFailures: findings.filter((f) => f.tier === "check"), errors, suppressed };
}
