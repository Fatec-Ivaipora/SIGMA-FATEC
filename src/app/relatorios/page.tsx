"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Download,
  ChevronDown,
  Send,
  FileClock,
  BadgeCheck,
  Percent,
  Trophy,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos } from "@/lib/data/eventos";
import { useTrabalhos, type TrabalhoStatus } from "@/lib/data/trabalhos";

// Rampa ordinal (uma única cor, do claro ao escuro) para as quatro etapas do
// funil + par categórico validado (verde/vermelho) para os dois desfechos.
// Validado com scripts/validate_palette.js do skill de dataviz — ver
// PRODUCT.md / arquitetura_tecnica.md para o registro das checagens.
const ETAPAS: { key: TrabalhoStatus; label: string; cor: string }[] = [
  { key: "submissao", label: "Em submissão", cor: "#7ab6e8" },
  { key: "aguardando_avaliacao", label: "Aguardando avaliação", cor: "#4a9bd4" },
  { key: "revisao", label: "Revisão solicitada", cor: "#2376b9" },
  { key: "avaliado", label: "Avaliado", cor: "#164a72" },
  { key: "aceito", label: "Aceito", cor: "#008300" },
  { key: "nao_aceito", label: "Recusado", cor: "#e34948" },
];

export default function RelatoriosPage() {
  return (
    <Suspense fallback={null}>
      <RelatoriosContent />
    </Suspense>
  );
}

function RelatoriosContent() {
  const { user, perfil, carregando } = useRequireAuth(["admin", "organizacao"]);
  const { eventos } = useEventos(perfil);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const searchParams = useSearchParams();

  const todosLabel =
    perfil?.papel === "admin" ? "Todos os eventos" : "Todos os meus eventos";
  const [eventoId, setEventoId] = useState(searchParams.get("evento") ?? "todos");

  const trabalhosDoEvento = useMemo(
    () =>
      eventoId === "todos"
        ? trabalhos
        : trabalhos.filter((t) => t.eventoId === eventoId),
    [trabalhos, eventoId],
  );

  const porEtapa = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const e of ETAPAS) mapa[e.key] = 0;
    for (const t of trabalhosDoEvento) mapa[t.status] = (mapa[t.status] ?? 0) + 1;
    return mapa;
  }, [trabalhosDoEvento]);

  const notasOrdenadas = useMemo(() => {
    const somaPorArea = new Map<string, { soma: number; n: number }>();
    for (const t of trabalhosDoEvento) {
      if (typeof t.notaAvaliador !== "number") continue;
      const atual = somaPorArea.get(t.areaTematica) ?? { soma: 0, n: 0 };
      somaPorArea.set(t.areaTematica, {
        soma: atual.soma + t.notaAvaliador,
        n: atual.n + 1,
      });
    }
    return Array.from(somaPorArea.entries())
      .map(([area, { soma, n }]) => ({ area, media: soma / n }))
      .sort((a, b) => b.media - a.media);
  }, [trabalhosDoEvento]);

  const totalSubmissoes = trabalhosDoEvento.length;
  const aceitos = porEtapa.aceito ?? 0;
  const recusados = porEtapa.nao_aceito ?? 0;
  const decididos = aceitos + recusados;
  const taxaAceite = decididos > 0 ? Math.round((aceitos / decididos) * 100) : 0;
  const maxEtapa = Math.max(1, ...ETAPAS.map((e) => porEtapa[e.key] ?? 0));

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/relatorios"
        userName={perfil.nome}
        userRoleLabel={perfil.papel === "admin" ? "Admin" : "Organização"}
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="flex flex-col gap-4 border-b border-fatec-line bg-white px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Relatórios
            </h1>
            <p className="text-sm text-fatec-muted">
              Visão consolidada do evento selecionado.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={eventoId}
                onChange={(e) => setEventoId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-fatec-navy-900 outline-none focus:border-fatec-sky-600"
              >
                <option value="todos">{todosLabel}</option>
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
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
            >
              <Download className="h-4 w-4" strokeWidth={1.75} />
              Exportar (PDF)
            </button>
          </div>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-fatec-line bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fatec-sky-100 text-fatec-sky-600">
                <Send className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold tabular-nums text-fatec-navy-900">
                {totalSubmissoes}
              </p>
              <p className="text-sm text-fatec-muted">Total de submissões</p>
            </div>
            <div className="rounded-2xl border border-fatec-line bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <BadgeCheck className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold tabular-nums text-fatec-navy-900">
                {aceitos}
              </p>
              <p className="text-sm text-fatec-muted">Aceitos</p>
            </div>
            <div className="rounded-2xl border border-fatec-line bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                <FileClock className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold tabular-nums text-fatec-navy-900">
                {recusados}
              </p>
              <p className="text-sm text-fatec-muted">Recusados</p>
            </div>
            <div className="rounded-2xl border border-fatec-line bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fatec-orange-100 text-fatec-orange-600">
                <Percent className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold tabular-nums text-fatec-navy-900">
                {taxaAceite}%
              </p>
              <p className="text-sm text-fatec-muted">
                Taxa de aceite (de {decididos} decididos)
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Trabalhos por etapa */}
            <div className="rounded-2xl border border-fatec-line bg-white p-6">
              <h2 className="text-base font-semibold text-fatec-navy-900">
                Trabalhos por etapa
              </h2>
              <p className="mt-0.5 text-sm text-fatec-muted">
                {eventoId === "todos"
                  ? todosLabel
                  : eventos.find((e) => e.id === eventoId)?.nome}
              </p>

              <div className="mt-6 flex flex-col gap-3">
                {ETAPAS.map((e) => {
                  const valor = porEtapa[e.key] ?? 0;
                  const pct = Math.max(2, (valor / maxEtapa) * 100);
                  return (
                    <div
                      key={e.key}
                      className="group flex items-center gap-3"
                      title={`${e.label}: ${valor}`}
                    >
                      <span className="w-48 flex-none truncate text-sm text-fatec-ink">
                        {e.label}
                      </span>
                      <div className="h-4 flex-1 rounded-full bg-fatec-navy-50">
                        <div
                          className="h-4 rounded-full transition-[filter] duration-150 group-hover:brightness-110"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: e.cor,
                          }}
                        />
                      </div>
                      <span className="w-10 flex-none text-right text-sm font-semibold tabular-nums text-fatec-navy-900">
                        {valor}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Nota média por área temática */}
            <div className="rounded-2xl border border-fatec-line bg-white p-6">
              <h2 className="text-base font-semibold text-fatec-navy-900">
                Nota média por área temática
              </h2>
              <p className="mt-0.5 text-sm text-fatec-muted">
                Soma dos 5 critérios do edital, 5 a 25 · melhor área em
                destaque
              </p>

              <div className="mt-6 flex flex-col gap-3">
                {notasOrdenadas.length === 0 && (
                  <p className="text-sm text-fatec-muted">
                    Nenhum trabalho avaliado ainda neste evento.
                  </p>
                )}
                {notasOrdenadas.map((n, i) => {
                  const pct = (n.media / 25) * 100;
                  const destaque = i === 0;
                  return (
                    <div
                      key={n.area}
                      className="group flex items-center gap-3"
                      title={`${n.area}: nota média ${n.media.toFixed(1)}`}
                    >
                      <span className="flex w-48 flex-none items-center gap-1.5 truncate text-sm text-fatec-ink">
                        {destaque && (
                          <Trophy
                            className="h-3.5 w-3.5 flex-none text-fatec-orange-500"
                            strokeWidth={1.75}
                          />
                        )}
                        <span className="truncate">{n.area}</span>
                      </span>
                      <div className="h-4 flex-1 rounded-full bg-fatec-navy-50">
                        <div
                          className="h-4 rounded-full transition-[filter] duration-150 group-hover:brightness-110"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: destaque ? "#ea741c" : "#2376b9",
                          }}
                        />
                      </div>
                      <span className="w-10 flex-none text-right text-sm font-semibold tabular-nums text-fatec-navy-900">
                        {n.media.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
