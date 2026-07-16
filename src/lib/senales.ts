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
    else if (/diferencia.*inventario|no cuadra|nunca.*cuadra|no (me |te |le )?cierra|se pierde plata|perdemos plata/.test(t)) s.senalF = "problema_inventario";
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
  turnosTotal: number,
  espejoEntregado: boolean
): string {
  const r = respuestaAsistente.toLowerCase();

  // Nuevas reglas para Etapa 4
  if (r.includes('retomar en otro momento')) return "CERRADA";
  if (momentoActual === "GIRO") return "CERRADA";

  // Reglas existentes
  if (r.includes("antes de cerrar, quiero ser transparente")) return "GIRO";
  if (r.includes("déjame ver si lo entendí") || r.includes("déjame ver si entendí")) return "ESPEJO";
  if (espejoEntregado && turnosTotal > 5) return "PROPUESTA";
  if (turnosTotal >= 2 && momentoActual === "APERTURA") return "ESCUCHA";
  return momentoActual;
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

// ════════════════════════════════════════════════════════════
// Arquitectura conversacional v3 — cerrojos duros gobernados por backend
// ════════════════════════════════════════════════════════════

type ConvVars = {
  creditoDigresion?: number | null;
  profundidadVinculo?: number | null;
  deudaDeValor?: string | null;
  espejoEntregado?: boolean | null;
} | null;

export type Variables = {
  credito_digresion: number;
  profundidad_vinculo: number;
  deuda_de_valor: "SALDADA" | "PENDIENTE";
  espejo_entregado: boolean;
};

export function actualizarVariables(
  userMsg: string,
  prevAssistantMsg: string,
  conv: ConvVars,
  nuevasSenales: Record<string, string>
): Variables {
  const u = (userMsg || "").toLowerCase();
  const a = (prevAssistantMsg || "").toLowerCase();

  let credito = conv?.creditoDigresion ?? 2;
  let vinculo = conv?.profundidadVinculo ?? 0;
  let deuda: "SALDADA" | "PENDIENTE" = (conv?.deudaDeValor as "SALDADA" | "PENDIENTE") ?? "SALDADA";
  let espejo = conv?.espejoEntregado ?? false;

  const huboSenalNueva = Object.keys(nuevasSenales).length > 0;

  // El usuario expresa dolor / fricción / carga emocional
  const expresaDolor =
    /cuesta|difícil|complicad|estr[eé]s|agotad|frustr|no doy abasto|desborda|abruma|no alcanzo|demasiado|solo con esto|sola con esto|se pierde plata|perdemos plata|sin saber por qu[eé]|me preocupa|no s[eé] (bien )?por qu[eé]|expuesto|riesgo/.test(u);

  // Alejandra validó algo real en su turno previo (lenguaje natural, no un guion fijo)
  const validoAntes =
    /eso que (describes|cuentas|mencionas)|es más común|desgasta|entiendo que|tiene sentido que|no est[aá]s sol[oa]|suena|te escucho|es v[aá]lido|pesa|desgaste|comi[eé]ndote/.test(a);

  // Alejandra construyó el espejo en su turno previo
  const construyoEspejo =
    /d[eé]jame ver si lo entend[ií]|si lo entend[ií] bien|resumiendo lo que me cuentas|para resumir lo que/.test(a);
  if (construyoEspejo) espejo = true;

  // Alejandra pidió un dato / avance / handoff en su turno previo
  const pidioAvance =
    /tu (celular|correo|n[uú]mero|whatsapp)|por d[oó]nde prefieres que te contact|te lo preparo|te dejo listo el whatsapp|te conecto con el equipo/.test(a);

  // Alejandra dio valor sustantivo en su turno previo
  const dioValor =
    validoAntes || construyoEspejo ||
    /la ley|el c[oó]digo|regula|conforme a|seg[uú]n el|artículo/.test(a);

  // --- profundidad_vinculo (0..3): primero se conecta ---
  // El vínculo crece cuando el usuario se abre (dolor real) o cuando Alejandra
  // ya validó algo real en su turno anterior — no solo cuando ambas cosas
  // coinciden en el mismo turno, que en conversación real casi nunca pasa.
  if (expresaDolor || (validoAntes && huboSenalNueva)) {
    vinculo = Math.min(vinculo + 1, 3);
  }

  // --- credito_digresion (0..3) ---
  if (huboSenalNueva) credito = Math.min(credito + 1, 3); // recarga
  else if (!expresaDolor) credito = Math.max(credito - 1, 0); // divagación

  // --- deuda_de_valor ---
  if (pidioAvance) deuda = "PENDIENTE";
  if (dioValor) deuda = "SALDADA"; // dar salda; el orden importa: dar gana

  return {
    credito_digresion: credito,
    profundidad_vinculo: vinculo,
    deuda_de_valor: deuda,
    espejo_entregado: espejo,
  };
}

export function calcularAutorizaciones(v: Variables, momento: string) {
  // ANCLAR solo si el crédito se agotó Y ya hay vínculo: nunca anclar antes
  const modoTurno =
    v.credito_digresion <= 0 && v.profundidad_vinculo >= 1 ? "ANCLAR" : "ACOMPAÑAR";

  // Espejo requiere cuadro suficiente + vínculo construido
  const puedeEspejo = momento !== "APERTURA" && v.profundidad_vinculo >= 2;

  // CERROJO MAESTRO: las tres condiciones a la vez
  const puedePedirContacto =
    v.profundidad_vinculo >= 2 &&
    v.deuda_de_valor === "SALDADA" &&
    v.espejo_entregado === true;

  return { modoTurno, puedeEspejo, puedePedirContacto };
}

type ConvDiagnostico = {
  sector?: string | null;
  tamano?: string | null;
  senalG?: string | null;
  senalL?: string | null;
  senalF?: string | null;
  senalB?: string | null;
};

export function construirDiagnostico(conv: ConvDiagnostico): string {
  const l: string[] = [];
  l.push(`Diagnóstico Alejandra · ${new Date().toLocaleDateString("es-CO")}`);
  if (conv.sector) l.push(`Sector: ${conv.sector}`);
  if (conv.tamano) l.push(`Tamaño: ${conv.tamano}`);

  const ejes: string[] = [];
  if (conv.senalG) ejes.push(`Gobernanza: ${conv.senalG}`);
  if (conv.senalL) ejes.push(`Legal: ${conv.senalL}`);
  if (conv.senalF) ejes.push(`Financiero: ${conv.senalF}`);
  if (conv.senalB) ejes.push(`Bienestar: ${conv.senalB}`);
  if (ejes.length) l.push("Frentes: " + ejes.join(" · "));

  return l.join("\n");
}

// 310 868 8648 en formato internacional — número principal de contacto
export const WA_EMPRESA = "573108688648";
// 314 443 6358 — reservado para ruteo futuro (round-robin / por sector)
export const WA_EMPRESA_ALT = "573144436358";

export function linkWhatsApp(conv: ConvDiagnostico, contacto: string): string {
  const texto =
    `Hola, vengo de conversar con Alejandra.\n` +
    `${construirDiagnostico(conv)}\n` +
    `Mi contacto: ${contacto}`;
  return `https://wa.me/${WA_EMPRESA}?text=${encodeURIComponent(texto)}`;
}
