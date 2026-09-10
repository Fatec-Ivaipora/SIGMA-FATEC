"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Calendar, FileText, ArrowRight } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos } from "@/lib/data/eventos";
import { useTrabalhos } from "@/lib/data/trabalhos";

export default function DashboardPage() {
  const { user, perfil, carregando } = useRequireAuth(["admin", "organizacao"]);
  const { eventos } = useEventos(perfil);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);

  const totalPorEvento = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const t of trabalhos) mapa[t.eventoId] = (mapa[t.eventoId] ?? 0) + 1;
    return mapa;
  }, [trabalhos]);

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/dashboard"
        userName={perfil.nome}
        userRoleLabel={perfil.papel === "admin" ? "Admin" : "Organização"}
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="flex flex-col gap-1 border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Bem-vindo(a), {perfil.nome}
          </h1>
          <p className="text-sm text-fatec-muted">
            Visão geral dos eventos. Abra os Relatórios de um evento para ver
            detalhes.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {eventos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-fatec-line bg-white p-10 text-center text-sm text-fatec-muted">
              Nenhum evento cadastrado ainda.
              {perfil.papel === "admin" && (
                <>
                  {" "}
                  <Link
                    href="/eventos"
                    className="font-medium text-fatec-sky-600 hover:text-fatec-navy-800"
                  >
                    Cadastre o primeiro evento
                  </Link>
                  .
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {eventos.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/relatorios?evento=${encodeURIComponent(ev.id)}`}
                  className="group flex flex-col justify-between rounded-2xl border border-fatec-line bg-white p-5 transition-colors hover:border-fatec-sky-600"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold leading-snug text-fatec-navy-900">
                        {ev.nome}
                      </h2>
                      {ev.destaque && (
                        <span className="flex-none rounded-full bg-fatec-orange-100 px-2.5 py-0.5 text-xs font-semibold text-fatec-orange-600">
                          Destaque
                        </span>
                      )}
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-fatec-muted">
                      <Calendar className="h-4 w-4 flex-none" strokeWidth={1.75} />
                      {ev.periodoSubmissao || "Data de inscrições não definida"}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-fatec-line pt-4">
                    <p className="flex items-center gap-1.5">
                      <FileText
                        className="h-4 w-4 flex-none text-fatec-navy-800"
                        strokeWidth={1.75}
                      />
                      <span className="text-2xl font-bold tabular-nums text-fatec-navy-900">
                        {totalPorEvento[ev.id] ?? 0}
                      </span>
                      <span className="text-sm text-fatec-muted">
                        submissões
                      </span>
                    </p>
                    <span className="flex items-center gap-1 text-sm font-medium text-fatec-sky-600 opacity-0 transition-opacity group-hover:opacity-100">
                      Relatório
                      <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
