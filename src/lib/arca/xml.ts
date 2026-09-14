import "server-only";

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function xmlDecimal2(n: number): string {
  return n.toFixed(2);
}

export function asXmlArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function xmlText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if ("#text" in rec) return xmlText(rec["#text"]);
    if ("_text" in rec) return xmlText(rec._text);
  }
  return null;
}

export function xmlInt(value: unknown): number | null {
  const t = xmlText(value);
  if (t == null || t.trim() === "") return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

export function xmlNumber(value: unknown): number | null {
  const t = xmlText(value);
  if (t == null || t.trim() === "") return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
