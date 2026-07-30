export type Turno = { role: string; content: string; timestamp?: string };

export function parseTurnos(value: unknown): Turno[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (t): t is Turno =>
      typeof t === "object" &&
      t !== null &&
      typeof (t as Record<string, unknown>).role === "string" &&
      typeof (t as Record<string, unknown>).content === "string"
  );
}

export function csvEscape(value: string): string {
  const needsQuotes = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}
