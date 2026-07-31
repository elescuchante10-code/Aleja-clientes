import type { PrismaClient } from "@prisma/client";
import { getDeepseekClient, DEEPSEEK_MODEL } from "./deepseek";
import type { Turno } from "./adminLeads";

export type ResumenIA = {
  resumen: string;
  dolorPrincipal: string;
  palabrasClave: string[];
  preguntasClave: string[];
};

export type MarcaAsistente = { asistente: string; empresa: string };

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

// Devuelve null si la generación falló (para no guardar un resultado a medias
// como si fuera definitivo); RESUMEN_VACIO es una respuesta válida y final
// cuando el cliente simplemente no escribió nada todavía.
export async function generarResumenIA(turnos: Turno[], marca: MarcaAsistente): Promise<ResumenIA | null> {
  const mensajesCliente = turnos.filter((t) => t.role === "user");
  if (mensajesCliente.length === 0) return RESUMEN_VACIO;

  const transcripcion = turnos
    .map((t) => `${t.role === "assistant" ? marca.asistente : "Cliente"}: ${t.content}`)
    .join("\n");

  try {
    const completion = await getDeepseekClient().chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: "system",
          content: `Eres un analista comercial. A partir de una conversación entre ${marca.asistente} (asistente de ventas de ${marca.empresa}) y un cliente potencial, extrae SOLO información objetiva de lo que dijo el cliente, sin inventar nada. Responde ÚNICAMENTE con un JSON de esta forma exacta: {"resumen": string (máximo 2 frases sobre quién es el cliente y qué busca), "dolorPrincipal": string (el problema de negocio más relevante que mencionó, o "no identificado" si no hay ninguno claro), "palabrasClave": string[] (entre 3 y 6 términos o conceptos concretos que el cliente mencionó, no genéricos), "preguntasClave": string[] (entre 1 y 3 de las preguntas más importantes que hizo el cliente, textuales o casi textuales; si no hizo preguntas, un arreglo vacío)}.`,
        },
        { role: "user", content: transcripcion },
      ],
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    return normalizar(JSON.parse(raw));
  } catch (error) {
    console.error("Error al generar el resumen IA del lead:", error);
    return null;
  }
}

// Lee el resumen ya guardado en la conversación, o lo genera y lo guarda si
// todavía no existe. Se calcula una sola vez por conversación: si la
// generación falla (ej. clave de API inválida), no se guarda nada y se
// vuelve a intentar la próxima vez que se abra el panel.
//
// Actualiza resumenIA con SQL directo (no con `update()` de Prisma) para no
// pisar `updatedAt` — guardar el resumen no cuenta como actividad nueva de
// la conversación.
export async function obtenerOGenerarResumen(
  client: PrismaClient,
  conversacionId: string,
  resumenGuardado: unknown,
  turnos: Turno[],
  marca: MarcaAsistente
): Promise<ResumenIA> {
  if (resumenGuardado && typeof resumenGuardado === "object") {
    return normalizar(resumenGuardado);
  }
  const nuevoResumen = await generarResumenIA(turnos, marca);
  if (nuevoResumen === null) return RESUMEN_VACIO;

  await client
    .$executeRaw`UPDATE conversaciones SET "resumenIA" = ${JSON.stringify(nuevoResumen)}::jsonb WHERE id = ${conversacionId}`.catch(
    (error) => console.error("Error al guardar el resumen IA:", error)
  );
  return nuevoResumen;
}
