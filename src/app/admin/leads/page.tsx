import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { labelSenal, parseTurnos } from "@/lib/adminLeads";
import { obtenerOGenerarResumen, type ResumenIA } from "@/lib/adminSummary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leads — Paz Ortega",
};

const MOMENTO_LABEL: Record<string, string> = {
  APERTURA: "Apertura",
  ESCUCHA: "Escucha",
  ESPEJO: "Espejo",
  PROPUESTA: "Propuesta",
  GIRO: "Giro",
  CERRADA: "Cerrada",
};

function formatFecha(fecha: Date) {
  return fecha.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({
    include: { conversacion: true },
    orderBy: { createdAt: "desc" },
  });

  // Se calcula una sola vez por conversación: si ya está guardado, solo se lee.
  const resumenes = new Map<string, ResumenIA>();
  for (const lead of leads) {
    const turnos = parseTurnos(lead.conversacion.turnos);
    resumenes.set(
      lead.conversacion.id,
      await obtenerOGenerarResumen(lead.conversacion.id, lead.conversacion.resumenIA, turnos)
    );
  }

  return (
    <main className="min-h-dvh bg-crema px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#171717]">Leads</h1>
            <p className="text-sm text-gris">
              {leads.length} {leads.length === 1 ? "cliente potencial" : "clientes potenciales"} capturados por
              Alejandra
            </p>
          </div>
          <a
            href="/api/admin/leads/export"
            className="rounded-full bg-morado px-5 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Descargar CSV
          </a>
        </div>

        {leads.length === 0 ? (
          <p className="rounded-2xl bg-white/60 p-6 text-sm text-gris">Todavía no hay leads registrados.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {leads.map((lead) => {
              const turnos = parseTurnos(lead.conversacion.turnos);
              const resumen = resumenes.get(lead.conversacion.id);
              const senales = [
                lead.conversacion.sector && { label: lead.conversacion.sector },
                lead.conversacion.tamano && { label: lead.conversacion.tamano },
                labelSenal("G", lead.conversacion.senalG) && { label: labelSenal("G", lead.conversacion.senalG)! },
                labelSenal("L", lead.conversacion.senalL) && { label: labelSenal("L", lead.conversacion.senalL)! },
                labelSenal("F", lead.conversacion.senalF) && { label: labelSenal("F", lead.conversacion.senalF)! },
                labelSenal("B", lead.conversacion.senalB) && { label: labelSenal("B", lead.conversacion.senalB)! },
              ].filter((s): s is { label: string } => Boolean(s));

              return (
                <details
                  key={lead.id}
                  className="group rounded-2xl border border-beige-oscuro bg-white/70 p-5 open:bg-white"
                >
                  <summary className="flex list-none cursor-pointer flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <div>
                      <p className="font-medium text-[#171717]">
                        {lead.nombre ?? "Sin nombre"} <span className="font-normal text-gris">· {lead.contacto}</span>
                      </p>
                      <p className="text-xs text-gris">
                        {lead.tipoContacto} · {formatFecha(lead.createdAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-beige-oscuro px-3 py-1 text-xs font-medium text-[#171717]">
                      {MOMENTO_LABEL[lead.conversacion.momento] ?? lead.conversacion.momento}
                    </span>
                  </summary>

                  <div className="mt-4 flex flex-col gap-4 border-t border-beige-oscuro pt-4">
                    {senales.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {senales.map((s, i) => (
                          <span key={i} className="rounded-full bg-morado/10 px-3 py-1 text-xs text-[#171717]">
                            {s.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {resumen && (resumen.resumen || resumen.palabrasClave.length > 0 || resumen.preguntasClave.length > 0) && (
                      <div className="rounded-xl bg-beige-oscuro/50 p-4 text-sm">
                        {resumen.resumen && <p className="mb-2 text-[#171717]">{resumen.resumen}</p>}
                        <p className="mb-2">
                          <span className="font-semibold text-gris">Dolor principal: </span>
                          <span className="text-[#171717]">{resumen.dolorPrincipal}</span>
                        </p>
                        {resumen.palabrasClave.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {resumen.palabrasClave.map((palabra, i) => (
                              <span key={i} className="rounded-full bg-naranja/15 px-2.5 py-0.5 text-xs text-[#171717]">
                                {palabra}
                              </span>
                            ))}
                          </div>
                        )}
                        {resumen.preguntasClave.length > 0 && (
                          <ul className="list-disc space-y-1 pl-5 text-[#171717]">
                            {resumen.preguntasClave.map((pregunta, i) => (
                              <li key={i}>{pregunta}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    <details className="rounded-xl border border-beige-oscuro/70">
                      <summary className="cursor-pointer list-none px-4 py-2 text-xs font-medium text-gris [&::-webkit-details-marker]:hidden">
                        Ver conversación completa ({turnos.length} mensajes)
                      </summary>
                      <div className="flex flex-col gap-2 p-4 pt-0">
                        {turnos.map((turno, i) => (
                          <div
                            key={i}
                            className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                              turno.role === "assistant"
                                ? "self-start bg-morado/10 text-[#171717]"
                                : "self-end bg-naranja/10 text-[#171717]"
                            }`}
                          >
                            <p className="mb-1 text-[10px] font-semibold tracking-wide text-gris uppercase">
                              {turno.role === "assistant" ? "Alejandra" : "Cliente"}
                            </p>
                            <p className="whitespace-pre-wrap">{turno.content}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
