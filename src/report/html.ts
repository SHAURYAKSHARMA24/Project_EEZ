import type { Finding, RuleError, Suppression } from "../types.ts";
import { escapeHtml } from "./escape.ts";

function findingCard(finding: Finding): string {
  const flow = finding.source && finding.sink
    ? `<p class="flow"><span>${escapeHtml(finding.source)}</span><b>→</b><span>${escapeHtml(finding.sink)}</span></p>`
    : "";
  return `<article class="finding">
    <div class="finding-head"><code>${escapeHtml(finding.file)}:${finding.line}</code><span class="confidence">${escapeHtml(finding.confidence)}</span></div>
    <h3>${escapeHtml(finding.title)}</h3>
    ${flow}
    <p>${escapeHtml(finding.message)}</p>
    <div class="fix"><strong>Recommended fix</strong><p>${escapeHtml(finding.fix)}</p></div>
  </article>`;
}

function findingGroups(findings: Finding[]): string {
  if (findings.length === 0) {
    return `<section class="empty"><h2>No active findings</h2><p>The scan completed without an active check or audit finding.</p></section>`;
  }
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = `${finding.tier}\0${finding.ruleId}`;
    const group = groups.get(key) ?? [];
    group.push(finding);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => {
    const [tier, ruleId] = key.split("\0");
    return `<section class="group">
      <div class="group-head"><span class="tier ${tier}">${escapeHtml(tier)}</span><h2>${escapeHtml(ruleId)}</h2><span>${group.length}</span></div>
      ${group.map(findingCard).join("\n")}
    </section>`;
  }).join("\n");
}

function diagnosticSection(errors: RuleError[]): string {
  if (errors.length === 0) return "";
  return `<section class="group diagnostics">
    <div class="group-head"><span class="tier diagnostic">diagnostic</span><h2>Scan diagnostics</h2><span>${errors.length}</span></div>
    ${errors.map((error) => `<article class="finding"><div class="finding-head"><code>${escapeHtml(error.file)}</code></div><h3>${escapeHtml(error.ruleId)}</h3><p>${escapeHtml(error.message)}</p></article>`).join("\n")}
  </section>`;
}

export function renderHtml(
  findings: Finding[],
  errors: RuleError[] = [],
  suppressed: Suppression[] = [],
): string {
  const check = findings.filter((finding) => finding.tier === "check").length;
  const audit = findings.filter((finding) => finding.tier === "audit").length;
  const status = errors.length > 0 ? "Diagnostic" : check > 0 ? "Action required" : "Clear";
  const statusClass = errors.length > 0 ? "diagnostic" : check > 0 ? "blocked" : "clear";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EEZ security report</title>
  <style>
    :root{color-scheme:light dark;--bg:#0b1020;--panel:#141b2d;--muted:#9aa8c2;--text:#edf3ff;--line:#2a3650;--red:#ff6b7a;--amber:#f7c65c;--green:#56d69a;--blue:#78a9ff}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:1040px;margin:auto;padding:48px 24px 72px}header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:28px}h1{font-size:34px;line-height:1.1;margin:0 0 10px}h2,h3,p{margin-top:0}.lede{color:var(--muted);max-width:620px}.status{border:1px solid var(--line);border-radius:999px;padding:8px 14px;font-weight:700}.status.blocked{color:var(--red)}.status.clear{color:var(--green)}.status.diagnostic{color:var(--amber)}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:0 0 28px}.metric{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}.metric strong{display:block;font-size:26px}.metric span{color:var(--muted)}.group,.empty{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:20px;margin:16px 0}.group-head,.finding-head{display:flex;align-items:center;gap:12px}.group-head h2{margin:0;flex:1;font-size:19px}.tier{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border-radius:999px;padding:4px 8px;background:#24314c}.tier.check{color:var(--red)}.tier.audit{color:var(--amber)}.tier.diagnostic{color:var(--blue)}.finding{border-top:1px solid var(--line);padding:20px 0 0;margin-top:20px}.finding:first-of-type{border-top:0}.finding-head{justify-content:space-between;color:var(--muted)}code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.confidence{text-transform:uppercase;font-size:11px}.finding h3{margin:10px 0 8px}.flow{display:flex;gap:10px;align-items:center;color:var(--blue);font-weight:650}.fix{border-left:3px solid var(--green);padding:10px 14px;background:#101a25;border-radius:0 8px 8px 0}.fix p{margin:4px 0 0}.footer{color:var(--muted);margin-top:28px;font-size:13px}@media(max-width:700px){header{display:block}.status{display:inline-block;margin-top:12px}.summary{grid-template-columns:repeat(2,1fr)}}@media print{body{background:#fff;color:#111}.group,.empty,.metric{background:#fff;border-color:#bbb}.fix{background:#f5f5f5}}
  </style>
</head>
<body><main class="wrap">
  <header><div><h1>EEZ security report</h1><p class="lede">Deterministic checks for high-confidence security boundaries in AI-written TypeScript.</p></div><span class="status ${statusClass}">${status}</span></header>
  <section class="summary" aria-label="Summary">
    <div class="metric" aria-label="${check} check"><strong>${check}</strong><span>check</span></div>
    <div class="metric" aria-label="${audit} audit"><strong>${audit}</strong><span>audit</span></div>
    <div class="metric" aria-label="${errors.length} diagnostic"><strong>${errors.length}</strong><span>diagnostic</span></div>
    <div class="metric" aria-label="${suppressed.length} suppression"><strong>${suppressed.length}</strong><span>suppression</span></div>
  </section>
  ${findingGroups(findings)}
  ${diagnosticSection(errors)}
  <p class="footer">EEZ runs locally. Silence is not proof of safety.</p>
</main></body>
</html>
`;
}
