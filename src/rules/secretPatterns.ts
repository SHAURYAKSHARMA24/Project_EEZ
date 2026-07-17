export interface SecretPattern {
  id: string;
  label: string;
  regex: RegExp;
}

// Known, high-precision provider formats only — never entropy guessing.
export const SECRET_PATTERNS: SecretPattern[] = [
  { id: "openai", label: "OpenAI API key", regex: /\bsk-(?:proj-)?[A-Za-z0-9]{20,}\b/g },
  { id: "anthropic", label: "Anthropic API key", regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { id: "aws", label: "AWS access key id", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: "github", label: "GitHub token", regex: /\b(?:ghp|gho|ghs|ghr)_[A-Za-z0-9]{36}\b/g },
  { id: "github-pat", label: "GitHub fine-grained PAT", regex: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/g },
  { id: "stripe", label: "Stripe live secret key", regex: /\bsk_live_[A-Za-z0-9]{20,}\b/g },
  { id: "google", label: "Google API key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: "slack", label: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { id: "pem", label: "PEM private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
];

export function article(label: string): "A" | "An" {
  return /^[aeiou]/i.test(label.trim()) ? "An" : "A";
}

function isPlaceholder(id: string, value: string): boolean {
  return id === "aws" && (value === "AKIAIOSFODNN7EXAMPLE" || value.endsWith("EXAMPLE"));
}

export function findSecretMatches(
  content: string,
): { value: string; index: number; label: string }[] {
  const results: { value: string; index: number; label: string }[] = [];
  for (const { id, regex, label } of SECRET_PATTERNS) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(content)) !== null) {
      if (!isPlaceholder(id, m[0])) {
        results.push({ value: m[0], index: m.index, label });
      }
    }
  }
  return results;
}
