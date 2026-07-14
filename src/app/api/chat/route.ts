import { NextResponse, after } from "next/server";
import { getDeepseekClient, DEEPSEEK_MODEL } from "@/lib/deepseek";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { extraerSenales, detectarMomento, detectarAvisoPolitica, extraerContacto } from "@/lib/senales";

function instruccionDeFase(turnosTotal: number) {
  if (turnosTotal < 3) {
    return "INSTRUCCIÓN: Estás en APERTURA, abre espacio con una invitación.";
  }
  if (turnosTotal < 8) {
    return "INSTRUCCIÓN: Estás en ESCUCHA, haz una sola pregunta de seguimiento natural.";
  }
  return "INSTRUCCIÓN: Tienes suficiente información, construye el espejo y propón el diagnóstico.";
}

export async function POST(request: Request) {
  try {
    const { messages, sessionId } = await request.json();

    if (!Array.isArray(messages)) {
      throw new Error("Invalid message format");
    }

    let conv = null;
    if (sessionId) {
      try {
        conv = await prisma.conversacion.findUnique({ where: { sessionId } });
      } catch (dbError) {
        console.error("Error al leer la conversación de la base de datos:", dbError);
      }
    }

    const turnosTotal = conv?.turnosTotal ?? 0;

    const contexto = `CONTEXTO DE ESTA CONVERSACIÓN:
Momento: ${conv?.momento ?? "APERTURA"}
Turnos: ${turnosTotal}
Sector: ${conv?.sector ?? "no identificado"}
Tamaño: ${conv?.tamano ?? "no identificado"}
Señal G: ${conv?.senalG ?? "sin señal"}
Señal L: ${conv?.senalL ?? "sin señal"}
Señal F: ${conv?.senalF ?? "sin señal"}
Señal B: ${conv?.senalB ?? "sin señal"}

${instruccionDeFase(turnosTotal)}`;

    const streamCompletion = await getDeepseekClient().chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: contexto },
        ...messages,
      ],
      max_tokens: 600,
      stream: true,
    });

    let textoRespuesta = "";
    let resolverTextoCompleto: (texto: string) => void;
    const textoCompletoPromise = new Promise<string>((resolve) => {
      resolverTextoCompleto = resolve;
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamCompletion) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (delta) {
              textoRespuesta += delta;
              controller.enqueue(encoder.encode(delta));
            }
          }
        } catch (streamError) {
          console.error("Error al leer el stream de DeepSeek:", streamError);
        } finally {
          controller.close();
          resolverTextoCompleto(textoRespuesta);
        }
      },
    });

    if (sessionId) {
      after(async () => {
        const textoFinal = await textoCompletoPromise;
        try {
          const ultimoMensajeUsuario =
            [...messages].reverse().find((m: { role: string }) => m.role === "user")
              ?.content ?? "";
          const nuevasSenales = extraerSenales(
            `${ultimoMensajeUsuario} ${textoFinal}`,
            conv
          );
          const nuevoMomento = detectarMomento(
            textoFinal,
            conv?.momento ?? "APERTURA",
            turnosTotal
          );
          const turnosActualizados = [
            ...messages,
            { role: "assistant", content: textoFinal, timestamp: new Date().toISOString() },
          ];

          const avisoPoliticaDado = conv?.aceptoPolitica || detectarAvisoPolitica(textoFinal.toLowerCase());
          const consentimientoNuevo = avisoPoliticaDado && !conv?.aceptoPolitica;

          const updateData: Prisma.ConversacionUpdateInput = {
            turnos: turnosActualizados,
            turnosTotal: { increment: 1 },
            momento: nuevoMomento,
            ...nuevasSenales,
            ...(consentimientoNuevo ? { aceptoPolitica: true, aceptadoAt: new Date() } : {}),
          };

          const convGuardada = await prisma.conversacion.upsert({
            where: { sessionId },
            update: updateData,
            create: {
              sessionId,
              momento: nuevoMomento,
              turnos: turnosActualizados,
              turnosTotal: 1,
              ...nuevasSenales,
              ...(avisoPoliticaDado && { aceptoPolitica: true, aceptadoAt: new Date() })
            },
          });

          if (avisoPoliticaDado) {
            const contacto = extraerContacto(ultimoMensajeUsuario);
            if (contacto) {
              try {
                await prisma.lead.upsert({
                  where: { conversacionId: convGuardada.id },
                  update: {
                    nombre: null,
                    contacto: contacto.valor,
                    tipoContacto: contacto.tipoContacto,
                  },
                  create: {
                    conversacionId: convGuardada.id,
                    nombre: null,
                    contacto: contacto.valor,
                    tipoContacto: contacto.tipoContacto,
                  },
                });
              } catch (leadError) {
                console.error("Error al guardar el lead en la base de datos:", leadError);
              }
            }
          }

        } catch (dbError) {
          console.error("Error al guardar en la base de datos:", dbError);
        }
      });
    }

    return new NextResponse(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Error en la llamada a DeepSeek:", error);
    return new NextResponse(
      JSON.stringify({ error: "Ocurrió un error al procesar tu solicitud" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
