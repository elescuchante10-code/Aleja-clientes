import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { labelSenal, parseTurnos } from "@/lib/adminLeads";
import { obtenerOGenerarResumen, type ResumenIA } from "@/lib/adminSummary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conversaciones — Paz Ortega",
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
  const conversaciones = await prisma.conversacion.findMany({
    include: { lead: true },
    orderBy: { updatedAt: "desc" },
  });

  const conContacto = conversaciones.filter((c) => c.lead).length;

  // Se calcula una sola vez por conversación: si ya está guardado, solo se lee.
  const resumenes = new Map<string, ResumenIA>();
  for (const conv of conversaciones) {
    const turnos = parseTurnos(conv.turnos);
    resumenes.set(conv.id, await obtenerOGenerarResumen(conv.id, conv.resumenIA, turnos));
  }

  return (
    <main className="min-h-dvh bg-crema px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#171717]">Conversaciones</h1>
            <p className="text-sm text-gris">
              {conversaciones.length} {conversaciones.length === 1 ? "conversación" : "conversaciones"} · {conContacto}{" "}
              con contacto capturado
            </p>
          </div>
          <a
            href="/api/admin/leads/export"
            className="rounded-full bg-morado px-5 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Descargar CSV
          </a>
        </div>

        {conversaciones.length === 0 ? (
          <p className="rounded-2xl bg-white/60 p-6 text-sm text-gris">Todavía no hay conversaciones registradas.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {conversaciones.map((conv) => {
              const turnos = parseTurnos(conv.turnos);
              const resumen = resumenes.get(conv.id);
              const senales = [
                conv.sector && { label: conv.sector },
                conv.tamano && { label: conv.tamano },
                labelSenal("G", conv.senalG) && { label: labelSenal("G", conv.senalG)! },
                labelSenal("L", conv.senalL) && { label: labelSenal("L", conv.senalL)! },
                labelSenal("F", conv.senalF) && { label: labelSenal("F", conv.senalF)! },
                labelSenal("B", conv.senalB) && { label: labelSenal("B", conv.senalB)! },
              ].filter((s): s is { label: string } => Boolean(s));

              return (
                <details
                  key={conv.id}
                  className="group rounded-2xl border border-beige-oscuro bg-white/70 p-5 open:bg-white"
                >
                  <summary className="flex list-none cursor-pointer flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <div>
                      <p className="font-medium text-[#171717]">
                        {conv.lead ? (
                          <>
                            {conv.lead.nombre ?? "Sin nombre"}{" "}
                            <span className="font-normal text-gris">· {conv.lead.contacto}</span>
                          </>
                        ) : (
                          <span className="text-gris italic">Sin contacto todavía</span>
                        )}
                      </p>
                      <p className="text-xs text-gris">
                        {conv.lead ? `${conv.lead.tipoContacto} · ` : ""}
                        {turnos.length} {turnos.length === 1 ? "mensaje" : "mensajes"} · {formatFecha(conv.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {conv.lead && (
                        <span className="rounded-full bg-morado px-3 py-1 text-xs font-medium text-white">
                          Contacto
                        </span>
                      )}
                      <span className="rounded-full bg-beige-oscuro px-3 py-1 text-xs font-medium text-[#171717]">
                        {MOMENTO_LABEL[conv.momento] ?? conv.momento}
                      </span>
                    </div>
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

                    {turnos.length === 0 ? (
                      <p className="text-sm text-gris">Sin mensajes registrados.</p>
                    ) : (
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
                    )}
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
