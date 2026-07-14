type SenalesConv = {
  sector?: string | null;
  tamano?: string | null;
  senalG?: string | null;
  senalL?: string | null;
  senalF?: string | null;
  senalB?: string | null;
} | null;

type SenalesExtraidas = {
  sector?: string;
  tamano?: string;
  senalG?: string;
  senalL?: string;
  senalF?: string;
  senalB?: string;
};

export function extraerSenales(texto: string, conv: SenalesConv): SenalesExtraidas {
  const t = texto.toLowerCase();
  const s: SenalesExtraidas = {};

  if (!conv?.sector) {
    if (/salud|médic|farmac|clínic/.test(t)) s.sector = "salud";
    else if (/legal|jurídic|abogad|notari/.test(t)) s.sector = "legal";
    else if (/contab|financ|auditor/.test(t)) s.sector = "financiero";
    else if (/educac|colegio|universidad/.test(t)) s.sector = "educacion";
    else if (/manufactur|logístic|export/.test(t)) s.sector = "manufactura";
    else if (/comercio|retail|tienda/.test(t)) s.sector = "comercio";
  }

  if (!conv?.tamano) {
    const n = t.match(/(\d+)\s*(emplead|person|trabaj)/);
    if (n) {
      const num = parseInt(n[1], 10);
      s.tamano = num < 10 ? "micro" : num < 50 ? "pequena" : num < 200 ? "mediana" : "grande";
    }
  }

  if (!conv?.senalG) {
    if (/no ten.*política|sin política|nadie decid/.test(t)) s.senalG = "sin_politica";
    else if (/chatgpt|copilot|gemini|ia.*uso/.test(t)) s.senalG = "usa_ia_sin_politica";
    else if (/política.*ia|gobernanza/.test(t)) s.senalG = "tiene_politica";
  }

  if (!conv?.senalL) {
    if (/word|carpeta|manual.*contrat|papel/.test(t)) s.senalL = "manual";
    else if (/contrato|documen.*legal|acta/.test(t)) s.senalL = "parcial";
  }

  if (!conv?.senalF) {
    if (/excel|hoja.*cálculo/.test(t)) s.senalF = "excel";
    else if (/siigo|alegra/.test(t)) s.senalF = "software";
    else if (/diferencia.*inventario|no cuadra/.test(t)) s.senalF = "problema_inventario";
  }

  if (!conv?.senalB) {
    if (/estrés|burnout|agotad|renunci.*mucho/.test(t)) s.senalB = "problema_detectado";
    else if (/bienestar|clima.*laboral|equipo.*bien/.test(t)) s.senalB = "mencionado";
  }

  return s;
}

export function detectarMomento(
  respuestaAsistente: string,
  momentoActual: string,
  turnosTotal: number
): string {
  const r = respuestaAsistente.toLowerCase();
  
  // Nuevas reglas para Etapa 4
  if (r.includes('retomar en otro momento')) return "CERRADA";
  if (momentoActual === "GIRO") return "CERRADA";

  // Reglas existentes
  if (r.includes("antes de cerrar, quiero ser transparente")) return "GIRO";
  if (r.includes("déjame ver si lo entendí") || r.includes("déjame ver si entendí")) return "ESPEJO";
  if (r.includes("diagnóstico") && turnosTotal > 5) return "PROPUESTA";
  if (turnosTotal >= 2 && momentoActual === "APERTURA") return "ESCUCHA";
  return momentoActual;
}

export function detectarAvisoPolitica(texto: string): boolean {
  const t = texto.toLowerCase();
  return t.includes('ley 1581') && t.includes('guarda');
}

export function extraerContacto(texto: string) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const celularRegex = /3\d{1}(?:[-\s]?\d){8}/;

  const emailMatch = texto.match(emailRegex);
  if (emailMatch) {
    return { tipoContacto: "email", valor: emailMatch[0] };
  }

  const celularMatch = texto.match(celularRegex);
  if (celularMatch) {
    const numeroNormalizado = celularMatch[0].replace(/\s|\-/g, '');
    return { tipoContacto: "celular", valor: numeroNormalizado };
  }

  return null;
}
