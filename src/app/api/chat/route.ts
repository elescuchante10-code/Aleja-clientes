import { NextResponse, after } from "next/server";
import { getDeepseekClient, DEEPSEEK_MODEL } from "@/lib/deepseek";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  extraerSenales,
  detectarMomento,
  extraerContacto,
  actualizarVariables,
  calcularAutorizaciones,
  linkWhatsApp,
} from "@/lib/senales";

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
    const ultimoMensajeUsuario =
      [...messages].reverse().find((m: { role: string }) => m.role === "user")?.content ?? "";
    const ultimaRespuestaAlejandra =
      [...messages].reverse().find((m: { role: string }) => m.role === "assistant")?.content ?? "";

    const nuevasSenales = extraerSenales(ultimoMensajeUsuario, conv);
    const vars = actualizarVariables(ultimoMensajeUsuario, ultimaRespuestaAlejandra, conv, nuevasSenales);
    const momento = detectarMomento(
      ultimaRespuestaAlejandra,
      conv?.momento ?? "APERTURA",
      turnosTotal,
      vars.espejo_entregado
    );
    const auth = calcularAutorizaciones(vars, momento);

    // Cerrojo del turno ANTERIOR: si ya estaba autorizada a pedir contacto y el
    // usuario acaba de responder con uno, disparamos el handoff a WhatsApp.
    const autorizacionPrevia = calcularAutorizaciones(
      {
        credito_digresion: conv?.creditoDigresion ?? 2,
        profundidad_vinculo: conv?.profundidadVinculo ?? 0,
        deuda_de_valor: (conv?.deudaDeValor as "SALDADA" | "PENDIENTE") ?? "SALDADA",
        espejo_entregado: conv?.espejoEntregado ?? false,
      },
      conv?.momento ?? "APERTURA"
    );
    const contacto = autorizacionPrevia.puedePedirContacto
      ? extraerContacto(ultimoMensajeUsuario)
      : null;
    const diagnosticoConv = {
      sector: nuevasSenales.sector ?? conv?.sector,
      tamano: nuevasSenales.tamano ?? conv?.tamano,
      senalG: nuevasSenales.senalG ?? conv?.senalG,
      senalL: nuevasSenales.senalL ?? conv?.senalL,
      senalF: nuevasSenales.senalF ?? conv?.senalF,
      senalB: nuevasSenales.senalB ?? conv?.senalB,
    };
    const whatsappLink = contacto ? linkWhatsApp(diagnosticoConv, contacto.valor) : null;

    const estado = `━━ ESTADO (backend · NO lo menciones al usuario) ━━
Momento: ${momento} · Turnos: ${turnosTotal}
Sector: ${diagnosticoConv.sector ?? "no identificado"} · Tamaño: ${diagnosticoConv.tamano ?? "no identificado"}
Señales — G:${diagnosticoConv.senalG ?? "—"} L:${diagnosticoConv.senalL ?? "—"} F:${diagnosticoConv.senalF ?? "—"} B:${diagnosticoConv.senalB ?? "—"}
credito_digresion: ${vars.credito_digresion} · profundidad_vinculo: ${vars.profundidad_vinculo}

─ AUTORIZACIONES DE ESTE TURNO ─
MODO_TURNO: ${auth.modoTurno}
PUEDES_CONSTRUIR_ESPEJO: ${auth.puedeEspejo ? "SI" : "NO"}
PUEDES_PEDIR_CONTACTO: ${auth.puedePedirContacto ? "SI" : "NO"}`;

    const streamCompletion = await getDeepseekClient().chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
        { role: "system", content: estado },
      ],
      max_tokens: 1024,
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
          if (whatsappLink) {
            const bloqueLink = `\n\n${whatsappLink}`;
            textoRespuesta += bloqueLink;
            controller.enqueue(encoder.encode(bloqueLink));
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
          const turnosActualizados = [
            ...messages,
            { role: "assistant", content: textoFinal, timestamp: new Date().toISOString() },
          ];

          const updateData: Prisma.ConversacionUpdateInput = {
            turnos: turnosActualizados,
            turnosTotal: { increment: 1 },
            momento,
            ...nuevasSenales,
            creditoDigresion: vars.credito_digresion,
            profundidadVinculo: vars.profundidad_vinculo,
            deudaDeValor: vars.deuda_de_valor,
            espejoEntregado: vars.espejo_entregado,
            ...(contacto ? { aceptoPolitica: true, aceptadoAt: new Date() } : {}),
          };

          const convGuardada = await prisma.conversacion.upsert({
            where: { sessionId },
            update: updateData,
            create: {
              sessionId,
              momento,
              turnos: turnosActualizados,
              turnosTotal: 1,
              ...nuevasSenales,
              creditoDigresion: vars.credito_digresion,
              profundidadVinculo: vars.profundidad_vinculo,
              deudaDeValor: vars.deuda_de_valor,
              espejoEntregado: vars.espejo_entregado,
              ...(contacto ? { aceptoPolitica: true, aceptadoAt: new Date() } : {}),
            },
          });

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
              // Ruta equipo (Resend): pendiente — requiere RESEND_API_KEY y
              // dominio verificado. Ver nota de seguimiento.
            } catch (leadError) {
              console.error("Error al guardar el lead en la base de datos:", leadError);
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
