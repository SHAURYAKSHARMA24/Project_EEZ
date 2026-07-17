import type { Finding, RuleError, Suppression } from "../types.ts";

export function renderSober(
  findings: Finding[],
  errors: RuleError[] = [],
  suppressed: Suppression[] = [],
): string {
  if (findings.length === 0 && errors.length === 0 && suppressed.length > 0) {
    return `0 check, 0 audit (0 total), ${suppressed.length} suppression(s)`;
  }

  if (findings.length === 0 && errors.length === 0) {
    return "✓ No findings. (Silence is not a proof of safety.)";
  }

  const findingBlocks = findings.map((f) => {
    const marker = f.tier === "check" ? "✗" : "•";
    return [
      `${marker} ${f.file}:${f.line}  [${f.confidence}] ${f.title}`,
      `    ${f.message}`,
      `    → ${f.fix}`,
    ].join("\n");
  });

  const errorBlocks = errors.map((error) =>
    [
      `! ${error.file}  [diagnostic] ${error.ruleId}`,
      `    ${error.message}`,
    ].join("\n"),
  );

  const check = findings.filter((f) => f.tier === "check").length;
  const audit = findings.filter((f) => f.tier === "audit").length;
  const suppressionSummary = suppressed.length === 0 ? "" : `, ${suppressed.length} suppression(s)`;
  const errorSummary = errors.length === 0 ? "" : `, ${errors.length} diagnostic(s)`;
  const summary = `${check} check, ${audit} audit (${findings.length} total)${suppressionSummary}${errorSummary}`;
  return [...findingBlocks, ...errorBlocks].join("\n\n") + `\n\n${summary}`;
}
