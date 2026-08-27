"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, FileClock, BadgeCheck, ArrowRight } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { navParaPerfil } from "@/lib/navAvaliacao";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos } from "@/lib/data/eventos";
import { useTrabalhos } from "@/lib/data/trabalhos";

const TODOS_MEUS_EVENTOS = "Todos os meus eventos";

export default function AvaliadorPainelPage() {
  const { user, perfil, carregando } = useRequireAuth(["avaliador", "moderador"]);
  const { eventos } = useEventos(perfil);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const [eventoId, setEventoId] = useState(TODOS_MEUS_EVENTOS);

  const resumo = useMemo(() => {
    const escopo =
      eventoId === TODOS_MEUS_EVENTOS
        ? trabalhos
        : trabalhos.filter((t) => t.eventoId === eventoId);

    return escopo.reduce(
      (acc, t) => {
        if (t.status === "aguardando_avaliacao") acc.aguardando += 1;
        if (t.status === "avaliado" || t.status === "aceito" || t.status === "nao_aceito") {
          acc.avaliados += 1;
        }
        return acc;
      },
      { aguardando: 0, avaliados: 0 },
    );
  }, [trabalhos, eventoId]);

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navParaPerfil(perfil)}
        activeHref="/avaliador"
        userName={perfil.nome}
        userRoleLabel="Avaliador"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="flex flex-col gap-4 border-b border-fatec-line bg-white px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Bem-vindo(a), {perfil.nome}
            </h1>
            <p className="text-sm text-fatec-muted">
              Trabalhos que a organização enviou para você avaliar.
            </p>
          </div>

          <div className="relative">
            <select
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-fatec-navy-900 outline-none focus:border-fatec-sky-600 sm:w-auto"
            >
              <option value={TODOS_MEUS_EVENTOS}>{TODOS_MEUS_EVENTOS}</option>
              {eventos.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.nome}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
              strokeWidth={1.75}
            />
          </div>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-xl">
            <div className="rounded-2xl border border-fatec-line bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fatec-navy-100 text-fatec-navy-800">
                <FileClock className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold text-fatec-navy-900">
                {resumo.aguardando}
              </p>
              <p className="text-sm text-fatec-muted">Aguardando sua nota</p>
            </div>
            <div className="rounded-2xl border border-fatec-line bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <BadgeCheck className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold text-fatec-navy-900">
                {resumo.avaliados}
              </p>
              <p className="text-sm text-fatec-muted">Avaliados por você</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/avaliador/trabalhos"
              className="inline-flex items-center gap-2 rounded-xl bg-fatec-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
            >
              Ver trabalhos para avaliar
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link
              href="/avaliador/eventos"
              className="text-sm font-semibold text-fatec-sky-600 hover:text-fatec-navy-800"
            >
              Ver meus eventos e área temática
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
