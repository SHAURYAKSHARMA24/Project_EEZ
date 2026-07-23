import type { Finding, RuleError, Suppression } from "../types.ts";
import { escapeCommandData, escapeCommandProperty } from "./escape.ts";

function findingAnnotation(finding: Finding): string {
  const level = finding.tier === "check" ? "error" : "warning";
  const properties = [
    `file=${escapeCommandProperty(finding.file)}`,
    `line=${finding.line}`,
    ...(finding.column === undefined ? [] : [`col=${finding.column}`]),
    `title=${escapeCommandProperty(`eez/${finding.ruleId}`)}`,
  ];
  const message = `${finding.title}: ${finding.message} Fix: ${finding.fix}`;
  return `::${level} ${properties.join(",")}::${escapeCommandData(message)}`;
}

function errorAnnotation(error: RuleError): string {
  const properties = [
    `file=${escapeCommandProperty(error.file)}`,
    `title=${escapeCommandProperty(`eez/${error.ruleId}`)}`,
  ];
  return `::error ${properties.join(",")}::${escapeCommandData(error.message)}`;
}

export function renderGithub(
  findings: Finding[],
  errors: RuleError[] = [],
  suppressed: Suppression[] = [],
): string {
  const check = findings.filter((finding) => finding.tier === "check").length;
  const audit = findings.filter((finding) => finding.tier === "audit").length;
  const suppressionSummary = suppressed.length === 0 ? "" : `, ${suppressed.length} suppression(s)`;
  const errorSummary = errors.length === 0 ? "" : `, ${errors.length} diagnostic(s)`;
  const summary = `${check} check, ${audit} audit (${findings.length} total)${suppressionSummary}${errorSummary}`;
  return [
    ...findings.map(findingAnnotation),
    ...errors.map(errorAnnotation),
    summary,
  ].join("\n");
}
