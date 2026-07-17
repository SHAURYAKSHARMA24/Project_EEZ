export function maskSecret(secret: string): string {
  if (secret.length <= 16) return "*".repeat(secret.length);
  return `${secret.slice(0, 3)}…${secret.slice(-4)}`;
}

export function lineOf(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}
