import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { csvEscape, parseTurnos } from "@/lib/adminLeads";
import { obtenerOGenerarResumen } from "@/lib/adminSummary";

export async function GET() {
  const leads = await prisma.lead.findMany({
    include: { conversacion: true },
    orderBy: { createdAt: "desc" },
  });

  const columnas = [
    "Nombre",
    "Contacto",
    "Tipo de contacto",
    "Sector",
    "Tamaño",
    "Momento",
    "Fecha",
    "Resumen",
    "Dolor principal",
    "Palabras clave",
    "Preguntas clave",
    "Conversación",
  ];

  const filas = [];
  for (const lead of leads) {
    const turnos = parseTurnos(lead.conversacion.turnos);
    const resumen = await obtenerOGenerarResumen(lead.conversacion.id, lead.conversacion.resumenIA, turnos);
    const transcripcion = turnos
      .map((t) => `${t.role === "assistant" ? "Alejandra" : "Cliente"}: ${t.content}`)
      .join("\n");

    filas.push(
      [
        lead.nombre ?? "",
        lead.contacto,
        lead.tipoContacto,
        lead.conversacion.sector ?? "",
        lead.conversacion.tamano ?? "",
        lead.conversacion.momento,
        lead.createdAt.toISOString(),
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
      "Content-Disposition": `attachment; filename="leads-paz-ortega-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
