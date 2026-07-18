import { redactKnownSecrets } from "../redact.ts";

function safe(value: string): string {
  return redactKnownSecrets(value);
}

export function escapeCommandData(value: string): string {
  return safe(value)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

export function escapeCommandProperty(value: string): string {
  return escapeCommandData(value)
    .replaceAll(":", "%3A")
    .replaceAll(",", "%2C");
}

export function escapeHtml(value: string): string {
  return safe(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
