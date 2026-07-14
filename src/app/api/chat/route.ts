import { NextResponse } from "next/server";
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

    const response = await getDeepseekClient().chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: contexto },
        ...messages,
      ],
      max_tokens: 600,
    });

    const textoRespuesta = response.choices[0].message.content ?? "";

    if (sessionId) {
      try {
        const ultimoMensajeUsuario =
          [...messages].reverse().find((m: { role: string }) => m.role === "user")
            ?.content ?? "";
        const nuevasSenales = extraerSenales(
          `${ultimoMensajeUsuario} ${textoRespuesta}`,
          conv
        );
        const nuevoMomento = detectarMomento(
          textoRespuesta,
          conv?.momento ?? "APERTURA",
          turnosTotal
        );
        const turnosActualizados = [
          ...messages,
          { role: "assistant", content: textoRespuesta, timestamp: new Date().toISOString() },
        ];

        const avisoPoliticaDado = conv?.aceptoPolitica || detectarAvisoPolitica(textoRespuesta.toLowerCase());
        const consentimientoNuevo = avisoPoliticaDado && !conv?.aceptoPolitica;

        const updateData: Prisma.ConversacionUpdateInput = {
          turnos: turnosActualizados,
          turnosTotal: { increment: 1 },
          momento: nuevoMomento,
          ...nuevasSenales,
          ...(consentimientoNuevo ? { aceptoPolitica: true, aceptadoAt: new Date() } : {}),
        };

        await prisma.conversacion.upsert({
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

        if (avisoPoliticaDado && conv) {
          const contacto = extraerContacto(ultimoMensajeUsuario);
          if (contacto) {
            try {
              await prisma.lead.upsert({
                where: { conversacionId: conv.id },
                update: {
                  nombre: null,
                  contacto: contacto.valor,
                  tipoContacto: contacto.tipoContacto,
                },
                create: {
                  conversacionId: conv.id,
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
    }

    return NextResponse.json({ respuesta: textoRespuesta });
  } catch (error) {
    console.error("Error en la llamada a DeepSeek:", error);
    return new NextResponse(
      JSON.stringify({ error: "Ocurrió un error al procesar tu solicitud" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
