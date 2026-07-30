import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { csvEscape, parseTurnos } from "@/lib/adminLeads";

export async function GET() {
  const leads = await prisma.lead.findMany({
    include: { conversacion: true },
    orderBy: { createdAt: "desc" },
  });

  const columnas = ["Nombre", "Contacto", "Tipo de contacto", "Sector", "Tamaño", "Momento", "Fecha", "Conversación"];

  const filas = leads.map((lead) => {
    const turnos = parseTurnos(lead.conversacion.turnos);
    const transcripcion = turnos
      .map((t) => `${t.role === "assistant" ? "Alejandra" : "Cliente"}: ${t.content}`)
      .join("\n");

    return [
      lead.nombre ?? "",
      lead.contacto,
      lead.tipoContacto,
      lead.conversacion.sector ?? "",
      lead.conversacion.tamano ?? "",
      lead.conversacion.momento,
      lead.createdAt.toISOString(),
      transcripcion,
    ]
      .map((v) => csvEscape(String(v)))
      .join(",");
  });

  const csv = [columnas.join(","), ...filas].join("\n");
  const BOM = "﻿"; // para que Excel abra bien los acentos

  return new NextResponse(BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-paz-ortega-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
