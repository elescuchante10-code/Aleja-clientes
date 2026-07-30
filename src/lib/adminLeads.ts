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

const SENAL_G_LABEL: Record<string, string> = {
  usa_ia_sin_politica: "Usa IA sin política",
  tiene_politica: "Tiene política de IA",
  sin_ia: "No usa IA",
};

const SENAL_L_LABEL: Record<string, string> = {
  manual: "Proceso manual",
  parcial: "Parcialmente integrado",
  integrado: "Totalmente integrado",
};

const SENAL_F_LABEL: Record<string, string> = {
  excel: "Usa Excel",
  software: "Usa software propio",
  problema_inventario: "Problema de inventario",
};

const SENAL_B_LABEL: Record<string, string> = {
  no_medido: "No mide resultados",
  mencionado: "Mencionó el problema",
  problema_detectado: "Problema detectado",
};

export function labelSenal(tipo: "G" | "L" | "F" | "B", valor: string | null): string | null {
  if (!valor) return null;
  const mapa = { G: SENAL_G_LABEL, L: SENAL_L_LABEL, F: SENAL_F_LABEL, B: SENAL_B_LABEL }[tipo];
  return mapa[valor] ?? valor;
}
