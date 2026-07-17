import type { Finding, Rule, RuleContext } from "../types.ts";
import { maskSecret } from "../mask.ts";
import { article, findSecretMatches } from "./secretPatterns.ts";

const SCANNABLE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const CLIENT_PREFIX = /\b(?:NEXT_PUBLIC_|VITE_)[A-Z0-9_]*/;

export const secretToBrowser: Rule = {
  id: "secret-to-browser",
  tier: "check",
  appliesTo: (p) => SCANNABLE.test(p) || p.split("/").pop()!.startsWith(".env"),
  run(ctx: RuleContext): Finding[] {
    const lines = ctx.content.split("\n");
    const findings: Finding[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (CLIENT_PREFIX.test(line)) {
        for (const hit of findSecretMatches(line)) {
          findings.push({
            ruleId: "secret-to-browser",
            tier: "check",
            title: `${hit.label} exposed to the browser`,
            file: ctx.filePath,
            line: i + 1,
            confidence: "high",
            masked: true,
            message:
              `${article(hit.label)} ${hit.label} (${maskSecret(hit.value)}) is attached to a client-exposed ` +
              `(NEXT_PUBLIC_/VITE_) variable in ${ctx.filePath} — it ships in the browser bundle.`,
            fix:
              "Server-only secrets must never use a NEXT_PUBLIC_/VITE_ prefix. Move it to a " +
              "server-only env var, read it server-side only, and rotate the exposed key.",
          });
        }
      }
    }
    return findings;
  },
};
