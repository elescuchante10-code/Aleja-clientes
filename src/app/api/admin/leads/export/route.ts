import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { csvEscape, parseTurnos } from "@/lib/adminLeads";
import { obtenerOGenerarResumen } from "@/lib/adminSummary";

export async function GET() {
  const conversaciones = await prisma.conversacion.findMany({
    include: { lead: true },
    orderBy: { updatedAt: "desc" },
  });

  const columnas = [
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
    const resumen = await obtenerOGenerarResumen(conv.id, conv.resumenIA, turnos);
    const transcripcion = turnos
      .map((t) => `${t.role === "assistant" ? "Alejandra" : "Cliente"}: ${t.content}`)
      .join("\n");

    filas.push(
      [
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
      "Content-Disposition": `attachment; filename="conversaciones-paz-ortega-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
