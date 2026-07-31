import type { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaJulio } from "@/lib/prismaJulio";
import { csvEscape, parseTurnos } from "@/lib/adminLeads";
import { obtenerOGenerarResumen, type MarcaAsistente } from "@/lib/adminSummary";

type Fuente = { origen: string; client: PrismaClient; marca: MarcaAsistente };

const FUENTES: Fuente[] = [
  { origen: "Paz Ortega", client: prisma, marca: { asistente: "Alejandra", empresa: "Paz Ortega" } },
  { origen: "Soluciones de IA", client: prismaJulio, marca: { asistente: "Julio", empresa: "Soluciones de IA" } },
];

async function cargarConversaciones(fuente: Fuente) {
  try {
    const conversaciones = await fuente.client.conversacion.findMany({
      include: { lead: true },
      orderBy: { updatedAt: "desc" },
    });
    return conversaciones.map((conv) => ({ ...conv, origen: fuente.origen, fuente }));
  } catch (error) {
    console.error(`Error al leer conversaciones de ${fuente.origen}:`, error);
    return [];
  }
}

export async function GET() {
  const resultados = await Promise.all(FUENTES.map(cargarConversaciones));
  const conversaciones = resultados.flat().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const columnas = [
    "Origen",
    "Nombre",
    "Contacto",
    "Tipo de contacto",
    "Sector",
    "Tamaño",
    "Momento",
    "Última actividad",
    "Resumen",
    "Dolor principal",
    "Palabras clave",
    "Preguntas clave",
    "Conversación",
  ];

  const filas = [];
  for (const conv of conversaciones) {
    const turnos = parseTurnos(conv.turnos);
    const resumen = await obtenerOGenerarResumen(conv.fuente.client, conv.id, conv.resumenIA, turnos, conv.fuente.marca);
    const transcripcion = turnos
      .map((t) => `${t.role === "assistant" ? conv.fuente.marca.asistente : "Cliente"}: ${t.content}`)
      .join("\n");

    filas.push(
      [
        conv.origen,
        conv.lead?.nombre ?? "",
        conv.lead?.contacto ?? "",
        conv.lead?.tipoContacto ?? "",
        conv.sector ?? "",
        conv.tamano ?? "",
        conv.momento,
        conv.updatedAt.toISOString(),
        resumen.resumen,
        resumen.dolorPrincipal,
        resumen.palabrasClave.join("; "),
        resumen.preguntasClave.join(" | "),
        transcripcion,
      ]
        .map((v) => csvEscape(String(v)))
        .join(",")
    );
  }

  const csv = [columnas.join(","), ...filas].join("\n");
  const BOM = "﻿"; // para que Excel abra bien los acentos

  return new NextResponse(BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="conversaciones-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
