import { maskSecret } from "./mask.ts";
import { findSecretMatches } from "./rules/secretPatterns.ts";

export function redactKnownSecrets(value: string): string {
  const matches = findSecretMatches(value).sort((a, b) => a.index - b.index);
  let result = "";
  let cursor = 0;

  for (const match of matches) {
    if (match.index < cursor) continue;
    result += value.slice(cursor, match.index) + maskSecret(match.value);
    cursor = match.index + match.value.length;
  }

  return result + value.slice(cursor);
}
