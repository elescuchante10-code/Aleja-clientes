import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { parseTurnos } from "@/lib/adminLeads";

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
                        {lead.tipoContacto} · {lead.conversacion.sector ?? "sector no identificado"} ·{" "}
                        {formatFecha(lead.createdAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-beige-oscuro px-3 py-1 text-xs font-medium text-[#171717]">
                      {MOMENTO_LABEL[lead.conversacion.momento] ?? lead.conversacion.momento}
                    </span>
                  </summary>

                  <div className="mt-4 flex flex-col gap-2 border-t border-beige-oscuro pt-4">
                    {turnos.length === 0 ? (
                      <p className="text-sm text-gris">Sin mensajes registrados.</p>
                    ) : (
                      turnos.map((turno, i) => (
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
                      ))
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
