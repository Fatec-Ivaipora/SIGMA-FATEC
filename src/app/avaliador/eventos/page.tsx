"use client";

import { CalendarDays, Tag } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { NAV_AVALIADOR } from "@/lib/navAvaliador";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos } from "@/lib/data/eventos";

export default function AvaliadorEventosPage() {
  const { perfil, carregando } = useRequireAuth(["avaliador"]);
  const { eventos } = useEventos(perfil);

  if (carregando || !perfil) return null;

  const atribuicoes = perfil.atribuicoesEventos ?? [];

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={NAV_AVALIADOR}
        activeHref="/avaliador/eventos"
        userName={perfil.nome}
        userRoleLabel="Avaliador"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Meus eventos
          </h1>
          <p className="text-sm text-fatec-muted">
            Eventos em que você foi cadastrado como avaliador e sua área
            temática em cada um.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="flex flex-col gap-3">
            {atribuicoes.map((a) => (
              <div
                key={a.eventoId}
                className="flex items-center gap-4 rounded-2xl border border-fatec-line bg-white p-5"
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                  <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-fatec-navy-900">
                    {eventos.find((e) => e.id === a.eventoId)?.nome ?? a.eventoId}
                  </p>
                  {(a.areasTematicas?.length ?? 0) > 0 && (
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-fatec-muted">
                      <Tag className="h-3.5 w-3.5 flex-none" strokeWidth={1.75} />
                      {a.areasTematicas!.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {atribuicoes.length === 0 && (
              <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
                Você ainda não foi cadastrado em nenhum evento.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
