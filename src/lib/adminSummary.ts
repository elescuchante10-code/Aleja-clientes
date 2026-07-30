import { getDeepseekClient, DEEPSEEK_MODEL } from "./deepseek";
import { prisma } from "./prisma";
import type { Turno } from "./adminLeads";

export type ResumenIA = {
  resumen: string;
  dolorPrincipal: string;
  palabrasClave: string[];
  preguntasClave: string[];
};

const RESUMEN_VACIO: ResumenIA = {
  resumen: "",
  dolorPrincipal: "no identificado",
  palabrasClave: [],
  preguntasClave: [],
};

function normalizar(parsed: unknown): ResumenIA {
  if (typeof parsed !== "object" || parsed === null) return RESUMEN_VACIO;
  const p = parsed as Record<string, unknown>;
  return {
    resumen: typeof p.resumen === "string" ? p.resumen : "",
    dolorPrincipal: typeof p.dolorPrincipal === "string" ? p.dolorPrincipal : "no identificado",
    palabrasClave: Array.isArray(p.palabrasClave) ? p.palabrasClave.filter((x): x is string => typeof x === "string") : [],
    preguntasClave: Array.isArray(p.preguntasClave)
      ? p.preguntasClave.filter((x): x is string => typeof x === "string")
      : [],
  };
}

export async function generarResumenIA(turnos: Turno[]): Promise<ResumenIA> {
  const mensajesCliente = turnos.filter((t) => t.role === "user");
  if (mensajesCliente.length === 0) return RESUMEN_VACIO;

  const transcripcion = turnos.map((t) => `${t.role === "assistant" ? "Alejandra" : "Cliente"}: ${t.content}`).join("\n");

  try {
    const completion = await getDeepseekClient().chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: "system",
          content:
            'Eres un analista comercial. A partir de una conversación entre Alejandra (asistente de ventas de Paz Ortega) y un cliente potencial, extrae SOLO información objetiva de lo que dijo el cliente, sin inventar nada. Responde ÚNICAMENTE con un JSON de esta forma exacta: {"resumen": string (máximo 2 frases sobre quién es el cliente y qué busca), "dolorPrincipal": string (el problema de negocio más relevante que mencionó, o "no identificado" si no hay ninguno claro), "palabrasClave": string[] (entre 3 y 6 términos o conceptos concretos que el cliente mencionó, no genéricos), "preguntasClave": string[] (entre 1 y 3 de las preguntas más importantes que hizo el cliente, textuales o casi textuales; si no hizo preguntas, un arreglo vacío)}.',
        },
        { role: "user", content: transcripcion },
      ],
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    return normalizar(JSON.parse(raw));
  } catch (error) {
    console.error("Error al generar el resumen IA del lead:", error);
    return RESUMEN_VACIO;
  }
}

// Lee el resumen ya guardado en la conversación, o lo genera y lo guarda si
// todavía no existe. Se calcula una sola vez por conversación.
export async function obtenerOGenerarResumen(conversacionId: string, resumenGuardado: unknown, turnos: Turno[]): Promise<ResumenIA> {
  if (resumenGuardado && typeof resumenGuardado === "object") {
    return normalizar(resumenGuardado);
  }
  const nuevoResumen = await generarResumenIA(turnos);
  await prisma.conversacion
    .update({ where: { id: conversacionId }, data: { resumenIA: nuevoResumen } })
    .catch((error) => console.error("Error al guardar el resumen IA:", error));
  return nuevoResumen;
}
