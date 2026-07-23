import { redactKnownSecrets } from "./redact.ts";
import type { Finding, RuleError, Suppression } from "./types.ts";

const CODE_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const DIRECTIVE_START = /^\s*\/\/\s*eez-ignore-next-line\b/;
const DIRECTIVE = /^\s*\/\/\s+eez-ignore-next-line\s+([a-z][a-z0-9-]*(?:\s*,\s*[a-z][a-z0-9-]*)*)\s+--\s+(.+?)\s*$/;

function isEnvFile(filePath: string): boolean {
  return filePath.split(/[\\/]/).pop()?.startsWith(".env") === true;
}

interface ParsedDirective {
  directiveLine: number;
  ruleIds: string[];
  reason: string;
}

interface SuppressionResult {
  findings: Finding[];
  suppressed: Suppression[];
  errors: RuleError[];
}

function diagnostic(file: string, line: number, message: string): RuleError {
  return {
    ruleId: "suppression",
    file: redactKnownSecrets(file),
    message: `${message} at line ${line}.`,
  };
}

function parseDirectives(
  filePath: string,
  content: string,
  knownRuleIds: ReadonlySet<string>,
): { directives: ParsedDirective[]; errors: RuleError[] } {
  if (!CODE_FILE.test(filePath) || isEnvFile(filePath)) return { directives: [], errors: [] };

  const directives: ParsedDirective[] = [];
  const errors: RuleError[] = [];
  const lines = content.split(/\r\n|\n|\r/);

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!DIRECTIVE_START.test(line)) continue;

    const match = DIRECTIVE.exec(line);
    if (match === null) {
      errors.push(diagnostic(filePath, index + 1, "Malformed EEZ suppression directive"));
      continue;
    }

    const ruleIds = match[1].split(",").map((ruleId) => ruleId.trim());
    const reason = match[2].trim();
    if (reason.length === 0 || new Set(ruleIds).size !== ruleIds.length) {
      errors.push(diagnostic(filePath, index + 1, "Malformed EEZ suppression directive"));
      continue;
    }

    if (ruleIds.some((ruleId) => !knownRuleIds.has(ruleId))) {
      errors.push(diagnostic(filePath, index + 1, "Unknown EEZ suppression rule"));
      continue;
    }

    directives.push({
      directiveLine: index + 1,
      ruleIds,
      reason,
    });
  }

  return { directives, errors };
}

export function applySuppressions(
  filePath: string,
  content: string,
  knownRuleIds: ReadonlySet<string>,
  findings: Finding[],
): SuppressionResult {
  const { directives, errors } = parseDirectives(filePath, content, knownRuleIds);
  const file = redactKnownSecrets(filePath);
  const suppressed: Suppression[] = [];
  let remaining = findings;

  for (const directive of directives) {
    const targetLine = directive.directiveLine + 1;
    for (const ruleId of directive.ruleIds) {
      const matchingFindings = remaining.filter(
        (finding) => finding.ruleId === ruleId && finding.file === file && finding.line === targetLine,
      );

      if (matchingFindings.length === 0) {
        errors.push(diagnostic(filePath, directive.directiveLine, "Stale EEZ suppression"));
        continue;
      }

      remaining = remaining.filter((finding) => !matchingFindings.includes(finding));
      suppressed.push({
        ruleId: redactKnownSecrets(ruleId),
        file,
        line: targetLine,
        directiveLine: directive.directiveLine,
        reason: redactKnownSecrets(directive.reason),
      });
    }
  }

  return { findings: remaining, suppressed, errors };
}
