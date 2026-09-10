"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Download,
  ChevronDown,
  Send,
  Users,
  Wallet,
  DollarSign,
  Trophy,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos } from "@/lib/data/eventos";
import { useTrabalhos, type Trabalho } from "@/lib/data/trabalhos";
import { useInscricoesRelatorio } from "@/lib/data/inscricoes";
import { separarGrupoSubArea } from "@/lib/areasTematicas";

const LIMITE_RANKING = 10;

type FiltroNota = "todos" | "avaliados" | "aceitos";

function nomeAutores(t: Trabalho): string {
  const extras = (t.participantesNomes ?? []).length;
  return extras > 0 ? `${t.alunoNome} + ${extras}` : t.alunoNome;
}

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

  // Pré-seleciona o evento em destaque assim que a lista carrega, só na
  // primeira vez e só se não veio um evento explícito pela URL (2026-08-31)
  // — evita ter que escolher toda vez o evento que já está em foco.
  const preSelecaoFeita = useRef(false);
  useEffect(() => {
    if (preSelecaoFeita.current || eventos.length === 0) return;
    preSelecaoFeita.current = true;
    if (searchParams.get("evento")) return;
    const destaque = eventos.find((e) => e.destaque);
    if (destaque) Promise.resolve().then(() => setEventoId(destaque.id));
  }, [eventos, searchParams]);

  const trabalhosDoEvento = useMemo(
    () =>
      eventoId === "todos"
        ? trabalhos
        : trabalhos.filter((t) => t.eventoId === eventoId),
    [trabalhos, eventoId],
  );

  const eventoIdsParaInscricoes = useMemo(
    () => (eventoId === "todos" ? eventos.map((e) => e.id) : [eventoId]),
    [eventoId, eventos],
  );
  const { inscricoes: inscricoesDoEvento } = useInscricoesRelatorio(eventoIdsParaInscricoes);

  const totalInscricoes = inscricoesDoEvento.length;
  const pagantes = useMemo(
    () => inscricoesDoEvento.filter((i) => i.status === "pago"),
    [inscricoesDoEvento],
  );
  const receitaArrecadada = useMemo(
    () => pagantes.reduce((soma, i) => soma + (i.valor ?? 0), 0),
    [pagantes],
  );
  const totalSubmissoes = trabalhosDoEvento.length;

  // Ranking por área temática — só entra quem já tem nota do avaliador,
  // ordenado da maior pra menor; áreas com mais trabalhos aparecem primeiro
  // na lista de chips.
  const porArea = useMemo(() => {
    const mapa = new Map<string, Trabalho[]>();
    for (const t of trabalhosDoEvento) {
      const lista = mapa.get(t.areaTematica) ?? [];
      lista.push(t);
      mapa.set(t.areaTematica, lista);
    }
    return Array.from(mapa.entries())
      .map(([area, lista]) => ({
        area,
        trabalhos: lista
          .filter((t) => typeof t.notaAvaliador === "number")
          .sort((a, b) => (b.notaAvaliador ?? 0) - (a.notaAvaliador ?? 0)),
      }))
      .filter((a) => a.trabalhos.length > 0)
      .sort((a, b) => b.trabalhos.length - a.trabalhos.length);
  }, [trabalhosDoEvento]);

  // Separa em chips simples e grupos com sub-área dentro (ex.: "Projetos
  // Integradores" tem 4 sub-áreas) — os grupos viram um único seletor com
  // dropdown em vez de um chip solto pra cada sub-área.
  const chipsArea = useMemo(() => {
    const simples: string[] = [];
    const grupos = new Map<string, string[]>();
    for (const { area } of porArea) {
      const partes = separarGrupoSubArea(area);
      if (!partes) {
        simples.push(area);
        continue;
      }
      const lista = grupos.get(partes.grupo) ?? [];
      lista.push(area);
      grupos.set(partes.grupo, lista);
    }
    return { simples, grupos: Array.from(grupos.entries()) };
  }, [porArea]);

  const [areaSelecionada, setAreaSelecionada] = useState<string | null>(null);
  const [expandidoRanking, setExpandidoRanking] = useState(false);

  // Mantém a área selecionada válida conforme o evento muda (ou seleciona a
  // primeira automaticamente na primeira carga) — nunca deixa selecionada
  // uma área que sumiu do filtro atual.
  useEffect(() => {
    if (porArea.length === 0) {
      if (areaSelecionada !== null) Promise.resolve().then(() => setAreaSelecionada(null));
      return;
    }
    if (!porArea.some((a) => a.area === areaSelecionada)) {
      Promise.resolve().then(() => setAreaSelecionada(porArea[0].area));
    }
  }, [porArea, areaSelecionada]);

  const areaAtual = porArea.find((a) => a.area === areaSelecionada);
  const trabalhosArea = areaAtual?.trabalhos ?? [];
  const trabalhosVisiveis = expandidoRanking
    ? trabalhosArea
    : trabalhosArea.slice(0, LIMITE_RANKING);

  function selecionarArea(area: string) {
    setAreaSelecionada(area);
    setExpandidoRanking(false);
  }

  // Nota média por área temática — filtro opcional por etapa, pra separar
  // "todo mundo que já recebeu nota" de "só quem já foi decidido".
  const [filtroNota, setFiltroNota] = useState<FiltroNota>("todos");
  const notasOrdenadas = useMemo(() => {
    const somaPorArea = new Map<string, { soma: number; n: number }>();
    for (const t of trabalhosDoEvento) {
      if (typeof t.notaAvaliador !== "number") continue;
      if (filtroNota === "avaliados" && t.status !== "avaliado") continue;
      if (filtroNota === "aceitos" && t.status !== "aceito") continue;
      const atual = somaPorArea.get(t.areaTematica) ?? { soma: 0, n: 0 };
      somaPorArea.set(t.areaTematica, {
        soma: atual.soma + t.notaAvaliador,
        n: atual.n + 1,
      });
    }
    return Array.from(somaPorArea.entries())
      .map(([area, { soma, n }]) => ({ area, media: soma / n, n }))
      .sort((a, b) => b.media - a.media);
  }, [trabalhosDoEvento, filtroNota]);

  const areaDestaque = notasOrdenadas[0];
  const melhorTrabalhoDestaque = areaDestaque
    ? porArea.find((a) => a.area === areaDestaque.area)?.trabalhos[0]
    : undefined;

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

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
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
                <Users className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold tabular-nums text-fatec-navy-900">
                {totalInscricoes}
              </p>
              <p className="text-sm text-fatec-muted">Inscrições</p>
            </div>
            <div className="rounded-2xl border border-fatec-line bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fatec-navy-100 text-fatec-navy-800">
                <Send className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold tabular-nums text-fatec-navy-900">
                {totalSubmissoes}
              </p>
              <p className="text-sm text-fatec-muted">
                Submissões
                {totalInscricoes > 0 &&
                  ` · ${Math.round((totalSubmissoes / totalInscricoes) * 100)}% dos inscritos`}
              </p>
            </div>
            <div className="rounded-2xl border border-fatec-orange-400/40 bg-gradient-to-br from-fatec-orange-100/40 to-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Wallet className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold tabular-nums text-fatec-navy-900">
                {pagantes.length}
              </p>
              <p className="text-sm text-fatec-muted">
                Pagantes
                {totalInscricoes > 0 &&
                  ` · ${Math.round((pagantes.length / totalInscricoes) * 100)}% dos inscritos`}
              </p>
            </div>
            <div className="rounded-2xl border border-fatec-orange-400/40 bg-gradient-to-br from-fatec-orange-100/40 to-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fatec-orange-100 text-fatec-orange-600">
                <DollarSign className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-2xl font-bold tabular-nums text-fatec-navy-900">
                {receitaArrecadada.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
              <p className="text-sm text-fatec-muted">Receita arrecadada</p>
            </div>
          </div>

          {/* Nota média por área temática */}
          <div className="mt-6 rounded-2xl border border-fatec-line bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-fatec-navy-900">
                  Nota média por área temática
                </h2>
                <p className="mt-0.5 text-sm text-fatec-muted">
                  Soma dos 5 critérios do edital, 5 a 25 · melhor área em destaque
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "todos", label: "Todos os trabalhos" },
                    { key: "avaliados", label: "Só avaliados" },
                    { key: "aceitos", label: "Só aceitos" },
                  ] as { key: FiltroNota; label: string }[]
                ).map((opcao) => (
                  <button
                    key={opcao.key}
                    type="button"
                    onClick={() => setFiltroNota(opcao.key)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      filtroNota === opcao.key
                        ? "border-fatec-navy-900 bg-fatec-navy-900 text-white"
                        : "border-fatec-line bg-fatec-navy-50 text-fatec-muted hover:border-fatec-orange-400"
                    }`}
                  >
                    {opcao.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[1.35fr_1fr] xl:items-center">
              <div className="flex flex-col gap-3.5">
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
                      className="group flex items-center gap-3.5"
                      title={`${n.area}: nota média ${n.media.toFixed(1)}, ${n.n} trabalhos`}
                    >
                      <span className="flex w-44 flex-none items-center gap-1.5 truncate text-sm text-fatec-ink">
                        {destaque && (
                          <Trophy
                            className="h-3.5 w-3.5 flex-none text-fatec-orange-500"
                            strokeWidth={1.75}
                          />
                        )}
                        <span className="truncate">{n.area}</span>
                      </span>
                      <div className="h-6 flex-1 rounded-xl bg-fatec-navy-50">
                        <div
                          className="flex h-6 items-center justify-end rounded-xl px-2.5 transition-[filter] duration-150 group-hover:brightness-110"
                          style={{
                            width: `${Math.max(8, pct)}%`,
                            backgroundColor: destaque ? "#ea741c" : "#2376b9",
                          }}
                        >
                          <span className="text-xs font-bold tabular-nums text-white">
                            {n.media.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <span className="w-20 flex-none text-right text-xs text-fatec-muted">
                        {n.n} trabalho{n.n === 1 ? "" : "s"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {areaDestaque && (
                <div className="flex flex-col gap-3 rounded-2xl border border-fatec-orange-400/30 bg-gradient-to-br from-fatec-orange-100/40 to-white p-5">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-fatec-orange-600">
                    <Trophy className="h-3.5 w-3.5" strokeWidth={2} />
                    Área destaque
                  </span>
                  <span className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
                    {areaDestaque.area}
                  </span>
                  <span className="text-sm text-fatec-muted">
                    nota média{" "}
                    <b className="font-bold tabular-nums text-fatec-ink">
                      {areaDestaque.media.toFixed(1)}
                    </b>{" "}
                    / 25
                  </span>
                  <span className="text-sm text-fatec-muted">
                    participação{" "}
                    <b className="font-bold tabular-nums text-fatec-ink">{areaDestaque.n}</b>{" "}
                    trabalho{areaDestaque.n === 1 ? "" : "s"}
                  </span>
                  {melhorTrabalhoDestaque && (
                    <div className="mt-1 border-t border-dashed border-fatec-line pt-3 text-sm text-fatec-muted">
                      <p className="mb-0.5 font-semibold text-fatec-ink">
                        {melhorTrabalhoDestaque.titulo}
                      </p>
                      {nomeAutores(melhorTrabalhoDestaque)} · nota{" "}
                      <span className="font-semibold tabular-nums">
                        {melhorTrabalhoDestaque.notaAvaliador?.toFixed(1)}
                      </span>{" "}
                      — melhor da área
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Melhores trabalhos por área temática */}
          <div className="mt-6 rounded-2xl border border-fatec-line bg-white p-6">
            <h2 className="text-base font-semibold text-fatec-navy-900">
              Melhores trabalhos por área temática
            </h2>
            <p className="mt-0.5 text-sm text-fatec-muted">
              {areaAtual
                ? `${areaAtual.area} · ${areaAtual.trabalhos.length} trabalho${areaAtual.trabalhos.length === 1 ? "" : "s"} avaliado${areaAtual.trabalhos.length === 1 ? "" : "s"}, ordenados pela nota do avaliador`
                : "Nenhum trabalho avaliado ainda neste evento."}
            </p>

            {porArea.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {chipsArea.simples.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => selecionarArea(area)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      area === areaSelecionada
                        ? "border-fatec-navy-900 bg-fatec-navy-900 text-white"
                        : "border-fatec-line bg-fatec-navy-50 text-fatec-muted hover:border-fatec-orange-400"
                    }`}
                  >
                    {area}
                  </button>
                ))}

                {/* Grupos com sub-área dentro (ex.: Projetos Integradores) —
                    um seletor só, com dropdown das sub-áreas que têm
                    trabalho, em vez de um chip solto pra cada uma. */}
                {chipsArea.grupos.map(([grupo, subAreasDoGrupo]) => {
                  const ativoNoGrupo = subAreasDoGrupo.includes(areaSelecionada ?? "");
                  return (
                    <div key={grupo} className="relative">
                      <select
                        value={ativoNoGrupo ? (areaSelecionada as string) : ""}
                        onChange={(e) => selecionarArea(e.target.value)}
                        className={`appearance-none rounded-full border py-1.5 pl-3.5 pr-7 text-xs font-semibold outline-none transition-colors ${
                          ativoNoGrupo
                            ? "border-fatec-navy-900 bg-fatec-navy-900 text-white"
                            : "border-fatec-line bg-fatec-navy-50 text-fatec-muted hover:border-fatec-orange-400"
                        }`}
                      >
                        {!ativoNoGrupo && (
                          <option value="" disabled>
                            {grupo}
                          </option>
                        )}
                        {subAreasDoGrupo.map((area) => (
                          <option key={area} value={area}>
                            {grupo} — {separarGrupoSubArea(area)?.subArea}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className={`pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 ${
                          ativoNoGrupo ? "text-white" : "text-fatec-muted"
                        }`}
                        strokeWidth={2}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-1.5">
              {trabalhosVisiveis.map((t, i) => (
                <div
                  key={t.id}
                  className={`grid grid-cols-[24px_1fr_auto] items-center gap-3 rounded-xl border px-2.5 py-2 ${
                    i === 0
                      ? "border-fatec-orange-400/40 bg-fatec-orange-100/50"
                      : "border-transparent hover:bg-fatec-navy-50"
                  }`}
                >
                  <span
                    className={`text-center text-xs font-bold tabular-nums ${
                      i === 0 ? "text-fatec-orange-600" : "text-fatec-muted"
                    }`}
                  >
                    {i + 1}º
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`truncate text-sm text-fatec-ink ${i === 0 ? "font-bold" : "font-semibold"}`}
                    >
                      {t.titulo}
                    </p>
                    <p className="truncate text-xs text-fatec-muted">{nomeAutores(t)}</p>
                  </div>
                  <div className="flex flex-none items-baseline gap-0.5">
                    <span className="text-base font-bold tabular-nums text-fatec-navy-900">
                      {t.notaAvaliador?.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-fatec-muted">/25</span>
                  </div>
                </div>
              ))}
            </div>

            {trabalhosArea.length > LIMITE_RANKING && (
              <button
                type="button"
                onClick={() => setExpandidoRanking((v) => !v)}
                className="mt-2 self-start text-xs font-semibold text-fatec-sky-600 hover:underline"
              >
                {expandidoRanking
                  ? "Ver menos ↑"
                  : `Ver mais ${trabalhosArea.length - LIMITE_RANKING} trabalhos ↓`}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
