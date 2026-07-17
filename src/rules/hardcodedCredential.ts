import type { Finding, Rule, RuleContext } from "../types.ts";
import { lineOf, maskSecret } from "../mask.ts";
import { article, findSecretMatches } from "./secretPatterns.ts";

const SCANNABLE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const isPem = (label: string) => label === "PEM private key";
const isEnvFile = (path: string) => path.split("/").pop()!.startsWith(".env");

export const hardcodedCredential: Rule = {
  id: "hardcoded-credential",
  tier: "check",
  appliesTo: (p) => SCANNABLE.test(p) || isEnvFile(p),
  run(ctx: RuleContext): Finding[] {
    if (isEnvFile(ctx.filePath) && !ctx.isGitTracked) return [];
    return findSecretMatches(ctx.content).map((hit): Finding => ({
      ruleId: "hardcoded-credential",
      tier: "check",
      title: `Hardcoded ${hit.label}`,
      file: ctx.filePath,
      line: lineOf(ctx.content, hit.index),
      confidence: "high",
      masked: true,
      message: isPem(hit.label)
        ? `A PEM private key is embedded in ${ctx.filePath}.`
        : `${article(hit.label)} ${hit.label} (${maskSecret(hit.value)}) is hardcoded in ${ctx.filePath}.`,
      fix:
        "Remove the literal, load it from an environment variable or secret manager, " +
        "and ROTATE the key now — anything committed must be treated as compromised.",
    }));
  },
};
