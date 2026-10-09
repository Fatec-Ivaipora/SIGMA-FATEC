"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import {
  Download,
  ChevronDown,
  Send,
  Users,
  UserCheck,
  Wallet,
  DollarSign,
  Trophy,
  Eye,
  EyeOff,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos } from "@/lib/data/eventos";
import { useTrabalhos, type Trabalho } from "@/lib/data/trabalhos";
import { useInscricoesRelatorio, diasConfirmadosCount } from "@/lib/data/inscricoes";
import { periodosDoEvento } from "@/lib/periodosPresenca";
import { separarGrupoSubArea } from "@/lib/areasTematicas";

const LIMITE_RANKING = 10;

type FiltroNota = "todos" | "avaliados" | "aceitos";

function nomeAutores(t: Trabalho): string {
  const extras = (t.participantesNomes ?? []).length;
  return extras > 0 ? `${t.alunoNome} + ${extras}` : t.alunoNome;
}

/** Linha de barra horizontal (2026-10-07) — extraído pra não repetir o
 * mesmo markup 3x na aba "Perfil dos inscritos" (vínculo, curso,
 * modalidade); mesmo visual (sm:contents pra empilhar no celular) já
 * usado nas seções de evento simples abaixo, só não reaproveitado lá pra
 * não arriscar mexer em código que já funciona. */
function BarraHorizontal({
  label,
  n,
  pct,
  cor,
  destaque,
  extra,
}: {
  label: string;
  n: number;
  pct: number;
  cor: string;
  destaque?: boolean;
  extra: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3.5">
      <span className="flex items-center gap-1.5 truncate text-sm text-fatec-ink sm:w-44 sm:flex-none">
        {destaque && (
          <Trophy className="h-3.5 w-3.5 flex-none text-fatec-orange-500" strokeWidth={1.75} />
        )}
        <span className="truncate">{label}</span>
      </span>
      <div className="flex items-center gap-3.5 sm:contents">
        <div className="h-6 flex-1 rounded-xl bg-fatec-navy-50">
          <div
            className="flex h-6 items-center justify-end rounded-xl px-2.5"
            style={{ width: `${Math.max(8, pct)}%`, backgroundColor: cor }}
          >
            <span className="text-xs font-bold tabular-nums text-white">{n}</span>
          </div>
        </div>
        <span className="w-20 flex-none text-right text-xs text-fatec-muted">{extra}</span>
      </div>
    </div>
  );
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

  // Evento "simples" (2026-10-02, pedido explícito do usuário) — o
  // relatório de evento completo (submissão/nota/área temática) não faz
  // sentido pra esse tipo, que não tem trabalho nenhum. Troca por dados que
  // existem de verdade pra evento simples: perfil de quem se inscreveu
  // (Fatec vs externo, curso) e presença por dia (só quando o evento tem
  // mais de 1 dia, ver diasDoEvento em src/lib/certificadoDias.ts).
  const eventoSelecionado = eventoId === "todos" ? undefined : eventos.find((e) => e.id === eventoId);
  const ehSimples = eventoSelecionado?.tipo === "simples";

  const presencaConfirmadaCount = useMemo(
    () => inscricoesDoEvento.filter((i) => diasConfirmadosCount(i) > 0).length,
    [inscricoesDoEvento],
  );

  const vinculoStats = useMemo(() => {
    const fatec = inscricoesDoEvento.filter((i) => i.vinculoFatec !== false).length;
    return { fatec, externo: inscricoesDoEvento.length - fatec };
  }, [inscricoesDoEvento]);

  // Curso não mora em InscricaoEvento (só em usuarios/{uid}) — busca à
  // parte, só pra quem é da Fatec (externo não tem curso). firestore.rules
  // libera admin/organização lerem qualquer usuarios/{uid}, então dá pra
  // consultar direto do client, em blocos de 30 (limite do "in").
  const [cursoPorUid, setCursoPorUid] = useState<Record<string, string>>({});
  const uidsFatecKey = useMemo(
    () =>
      inscricoesDoEvento
        .filter((i) => i.vinculoFatec !== false)
        .map((i) => i.uid)
        .join(","),
    [inscricoesDoEvento],
  );
  useEffect(() => {
    // Antes só rodava pra evento simples (2026-10-07, pedido explícito do
    // usuário: "Inscritos por curso" também importa pro evento completo,
    // pra planejar o próximo — quantos alunos de cada curso participam).
    if (!uidsFatecKey) {
      Promise.resolve().then(() => setCursoPorUid({}));
      return;
    }
    const uids = uidsFatecKey.split(",");
    let cancelado = false;
    (async () => {
      const blocos: string[][] = [];
      for (let i = 0; i < uids.length; i += 30) blocos.push(uids.slice(i, i + 30));
      const resultados = await Promise.all(
        blocos.map((bloco) =>
          getDocs(query(collection(db, "usuarios"), where(documentId(), "in", bloco))),
        ),
      );
      if (cancelado) return;
      const mapa: Record<string, string> = {};
      resultados.forEach((snap) =>
        snap.forEach((d) => {
          const curso = d.data().curso as string | undefined;
          if (curso) mapa[d.id] = curso;
        }),
      );
      setCursoPorUid(mapa);
    })();
    return () => {
      cancelado = true;
    };
  }, [uidsFatecKey]);

  const porCurso = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const i of inscricoesDoEvento) {
      const curso = cursoPorUid[i.uid];
      if (!curso) continue;
      mapa.set(curso, (mapa.get(curso) ?? 0) + 1);
    }
    return Array.from(mapa.entries())
      .map(([curso, n]) => ({ curso, n }))
      .sort((a, b) => b.n - a.n);
  }, [inscricoesDoEvento, cursoPorUid]);

  const diasEventoSelecionado = eventoSelecionado ? periodosDoEvento(eventoSelecionado) : 1;
  // "Período" em vez de "Dia" quando o evento tem mais janelas de presença
  // que dias de calendário (2026-10-08, ver periodosDoEvento).
  const rotuloDiaSelecionado = eventoSelecionado?.periodosPresenca ? "Período" : "Dia";
  // Nome de cada período (2026-10-08, ver rotuloPeriodo em
  // src/lib/periodosPresenca.ts) — capturado fora do useMemo abaixo pra não
  // precisar depender de eventoSelecionado inteiro ali dentro, só do array
  // de rótulos em si.
  const labelsPeriodosEvento = eventoSelecionado?.periodosPresencaLabels;
  const presencaPorDia = useMemo(() => {
    if (!ehSimples || diasEventoSelecionado <= 1) return [];
    return Array.from({ length: diasEventoSelecionado }, (_, idx) => {
      const dia = idx + 1;
      const n = inscricoesDoEvento.filter((i) => i.presencasConfirmadas?.[String(dia)]).length;
      const rotulo = labelsPeriodosEvento?.[idx]?.trim() || `${rotuloDiaSelecionado} ${dia}`;
      return { dia, n, rotulo };
    });
  }, [ehSimples, diasEventoSelecionado, inscricoesDoEvento, labelsPeriodosEvento, rotuloDiaSelecionado]);

  // Modalidade de apresentação (2026-10-07, pedido explícito do usuário) —
  // escolhida pelo aluno já na submissão (ver modalidadeApresentacao em
  // src/lib/data/trabalhos.ts), então dá pra contar independente da etapa
  // do pipeline — útil pra planejar salas/horário do PRÓXIMO evento antes
  // mesmo da avaliação acontecer, não só depois.
  const modalidadeStats = useMemo(() => {
    let oral = 0;
    let rodaConversa = 0;
    let semEscolha = 0;
    for (const t of trabalhosDoEvento) {
      if (t.modalidadeApresentacao === "oral") oral++;
      else if (t.modalidadeApresentacao === "roda_conversa") rodaConversa++;
      else semEscolha++;
    }
    return { oral, rodaConversa, semEscolha };
  }, [trabalhosDoEvento]);

  // Abas do relatório de evento completo (2026-10-07, pedido explícito do
  // usuário): "Perfil" é informativo pro planejamento (serve o processo
  // inteiro, desde antes da avaliação existir); "Avaliação" é a parte
  // pedagógica (nota média, melhores trabalhos — só faz sentido depois que
  // os trabalhos já têm nota). Evento simples não usa essas abas, tem as
  // próprias seções fixas mais abaixo.
  const [abaRelatorioCompleto, setAbaRelatorioCompleto] = useState<"perfil" | "avaliacao">(
    "perfil",
  );

  // Esconder "Receita arrecadada" (2026-10-09, pedido explícito do usuário
  // — "igual banco... às vezes temos que mostrar alguma coisa aqui e não
  // queremos expor isso") — começa OCULTO por padrão (confirmado pelo
  // usuário), sem persistir entre sessões: é uma proteção pra quando a tela
  // está sendo mostrada pra alguém, não uma preferência de longo prazo.
  const [receitaOculta, setReceitaOculta] = useState(true);

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
                {ehSimples ? (
                  <UserCheck className="h-5 w-5" strokeWidth={1.75} />
                ) : (
                  <Send className="h-5 w-5" strokeWidth={1.75} />
                )}
              </span>
              <p className="mt-4 text-2xl font-bold tabular-nums text-fatec-navy-900">
                {ehSimples ? presencaConfirmadaCount : totalSubmissoes}
              </p>
              <p className="text-sm text-fatec-muted">
                {ehSimples ? "Presença confirmada" : "Submissões"}
                {totalInscricoes > 0 &&
                  ` · ${Math.round(((ehSimples ? presencaConfirmadaCount : totalSubmissoes) / totalInscricoes) * 100)}% dos inscritos`}
              </p>
            </div>
            <div className="rounded-2xl border border-fatec-orange-400/40 bg-fatec-orange-50 p-5">
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
            <div className="rounded-2xl border border-fatec-orange-400/40 bg-fatec-orange-50 p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fatec-orange-100 text-fatec-orange-600">
                  <DollarSign className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <button
                  type="button"
                  onClick={() => setReceitaOculta((v) => !v)}
                  aria-label={receitaOculta ? "Mostrar receita arrecadada" : "Esconder receita arrecadada"}
                  title={receitaOculta ? "Mostrar valor" : "Esconder valor"}
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-fatec-orange-200 bg-white text-fatec-orange-600 transition-colors hover:bg-fatec-orange-100"
                >
                  {receitaOculta ? (
                    <EyeOff className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={2} />
                  )}
                </button>
              </div>
              <p className="mt-4 text-2xl font-bold tabular-nums text-fatec-navy-900">
                {receitaOculta
                  ? "R$ ••••••"
                  : receitaArrecadada.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
              </p>
              <p className="text-sm text-fatec-muted">Receita arrecadada</p>
            </div>
          </div>

          {/* Abas do evento completo (2026-10-07, pedido explícito do
              usuário) — "Perfil dos inscritos" é informativo pro
              planejamento do PRÓXIMO evento (vínculo, curso, modalidade —
              dá pra ver mesmo antes de qualquer avaliação acontecer);
              "Avaliação dos trabalhos" é a parte pedagógica de sempre
              (nota média, melhores trabalhos — só faz sentido depois que
              os trabalhos já têm nota). Evento simples não usa isso, tem
              as próprias seções fixas mais abaixo. */}
          {!ehSimples && (
          <div className="mt-6 flex flex-wrap gap-1 rounded-xl bg-fatec-navy-50 p-1">
            {(
              [
                { key: "perfil", label: "Perfil dos inscritos" },
                { key: "avaliacao", label: "Avaliação dos trabalhos" },
              ] as { key: "perfil" | "avaliacao"; label: string }[]
            ).map((aba) => (
              <button
                key={aba.key}
                type="button"
                onClick={() => setAbaRelatorioCompleto(aba.key)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  abaRelatorioCompleto === aba.key
                    ? "bg-white text-fatec-navy-900 shadow-sm"
                    : "text-fatec-muted hover:text-fatec-navy-900"
                }`}
              >
                {aba.label}
              </button>
            ))}
          </div>
          )}

          {!ehSimples && abaRelatorioCompleto === "perfil" && (
          <div className="mt-6 flex flex-col gap-6">
            <div className="rounded-2xl border border-fatec-line bg-white p-6">
              <h2 className="text-base font-semibold text-fatec-navy-900">
                Perfil dos inscritos
              </h2>
              <p className="mt-0.5 text-sm text-fatec-muted">Vínculo com a Fatec</p>

              <div className="mt-5 flex flex-col gap-3.5">
                {[
                  { label: "Alunos da Fatec", n: vinculoStats.fatec, cor: "#2376b9" },
                  { label: "De fora", n: vinculoStats.externo, cor: "#5b6b78" },
                ].map((linha) => {
                  const max = Math.max(vinculoStats.fatec, vinculoStats.externo, 1);
                  return (
                    <BarraHorizontal
                      key={linha.label}
                      label={linha.label}
                      n={linha.n}
                      pct={(linha.n / max) * 100}
                      cor={linha.cor}
                      extra={
                        totalInscricoes > 0
                          ? `${Math.round((linha.n / totalInscricoes) * 100)}%`
                          : "0%"
                      }
                    />
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-fatec-line bg-white p-6">
              <h2 className="text-base font-semibold text-fatec-navy-900">
                Inscritos por curso
              </h2>
              <p className="mt-0.5 text-sm text-fatec-muted">
                Só alunos da Fatec — quem é de fora não tem curso
              </p>

              <div className="mt-5 flex flex-col gap-3.5">
                {porCurso.length === 0 && (
                  <p className="text-sm text-fatec-muted">
                    Nenhum aluno da Fatec inscrito ainda.
                  </p>
                )}
                {porCurso.map((c, i) => (
                  <BarraHorizontal
                    key={c.curso}
                    label={c.curso}
                    n={c.n}
                    pct={(c.n / (porCurso[0]?.n ?? 1)) * 100}
                    cor={i === 0 ? "#ea741c" : "#2376b9"}
                    destaque={i === 0}
                    extra={`${c.n} inscrito${c.n === 1 ? "" : "s"}`}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-fatec-line bg-white p-6">
              <h2 className="text-base font-semibold text-fatec-navy-900">
                Modalidade de apresentação
              </h2>
              <p className="mt-0.5 text-sm text-fatec-muted">
                Escolhida por cada autor na submissão — ajuda a planejar salas
                e horário do próximo evento
              </p>

              <div className="mt-5 flex flex-col gap-3.5">
                {totalSubmissoes === 0 ? (
                  <p className="text-sm text-fatec-muted">
                    Nenhum trabalho submetido ainda neste evento.
                  </p>
                ) : (
                  [
                    { label: "Apresentação Oral", n: modalidadeStats.oral, cor: "#2376b9" },
                    { label: "Roda de Conversa", n: modalidadeStats.rodaConversa, cor: "#ea741c" },
                    ...(modalidadeStats.semEscolha > 0
                      ? [{ label: "Ainda não escolhida", n: modalidadeStats.semEscolha, cor: "#5b6b78" }]
                      : []),
                  ].map((linha) => (
                    <BarraHorizontal
                      key={linha.label}
                      label={linha.label}
                      n={linha.n}
                      pct={(linha.n / totalSubmissoes) * 100}
                      cor={linha.cor}
                      extra={`${Math.round((linha.n / totalSubmissoes) * 100)}%`}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
          )}

          {!ehSimples && abaRelatorioCompleto === "avaliacao" && (
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
                      className="group flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3.5"
                      title={`${n.area}: nota média ${n.media.toFixed(1)}, ${n.n} trabalhos`}
                    >
                      <span className="flex items-center gap-1.5 truncate text-sm text-fatec-ink sm:w-44 sm:flex-none">
                        {destaque && (
                          <Trophy
                            className="h-3.5 w-3.5 flex-none text-fatec-orange-500"
                            strokeWidth={1.75}
                          />
                        )}
                        <span className="truncate">{n.area}</span>
                      </span>
                      {/* sm:contents (2026-10-02) — abaixo de sm, a barra e a
                          contagem formam uma 2ª linha própria (nome da área
                          não fica mais espremido numa coluna de 176px fixos,
                          que não cabia em tela de celular); de sm pra cima,
                          os dois viram itens diretos do flex-row de cima,
                          igual sempre foi (mesmo truque já usado em
                          InscritosEventoModal.tsx). */}
                      <div className="flex items-center gap-3.5 sm:contents">
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
                    </div>
                  );
                })}
              </div>

              {areaDestaque && (
                <div className="flex flex-col gap-3 rounded-2xl border border-fatec-orange-400/30 bg-fatec-orange-50 p-5">
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
          )}

          {!ehSimples && abaRelatorioCompleto === "avaliacao" && (
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
          )}

          {/* Perfil dos inscritos e Inscritos por curso — só evento
              "simples" (2026-10-02, pedido explícito do usuário: o
              relatório de evento completo não fazia sentido aqui, era uma
              cópia sem submissão/área nenhuma). Reaproveita o mesmo estilo
              de barra das seções acima, com os dados que esse tipo de
              evento realmente tem. */}
          {ehSimples && (
          <div className="mt-6 rounded-2xl border border-fatec-line bg-white p-6">
            <h2 className="text-base font-semibold text-fatec-navy-900">
              Perfil dos inscritos
            </h2>
            <p className="mt-0.5 text-sm text-fatec-muted">Vínculo com a Fatec</p>

            <div className="mt-5 flex flex-col gap-3.5">
              {[
                { label: "Alunos da Fatec", n: vinculoStats.fatec, cor: "#2376b9" },
                { label: "De fora", n: vinculoStats.externo, cor: "#5b6b78" },
              ].map((linha) => {
                const max = Math.max(vinculoStats.fatec, vinculoStats.externo, 1);
                const pct = (linha.n / max) * 100;
                return (
                  <div
                    key={linha.label}
                    className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3.5"
                  >
                    <span className="truncate text-sm text-fatec-ink sm:w-32 sm:flex-none">
                      {linha.label}
                    </span>
                    <div className="flex items-center gap-3.5 sm:contents">
                      <div className="h-6 flex-1 rounded-xl bg-fatec-navy-50">
                        <div
                          className="flex h-6 items-center justify-end rounded-xl px-2.5"
                          style={{ width: `${Math.max(8, pct)}%`, backgroundColor: linha.cor }}
                        >
                          <span className="text-xs font-bold tabular-nums text-white">
                            {linha.n}
                          </span>
                        </div>
                      </div>
                      <span className="w-20 flex-none text-right text-xs text-fatec-muted">
                        {totalInscricoes > 0 ? Math.round((linha.n / totalInscricoes) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {ehSimples && (
          <div className="mt-6 rounded-2xl border border-fatec-line bg-white p-6">
            <h2 className="text-base font-semibold text-fatec-navy-900">
              Inscritos por curso
            </h2>
            <p className="mt-0.5 text-sm text-fatec-muted">
              Só alunos da Fatec — quem é de fora não tem curso
            </p>

            <div className="mt-5 flex flex-col gap-3.5">
              {porCurso.length === 0 && (
                <p className="text-sm text-fatec-muted">
                  Nenhum aluno da Fatec inscrito ainda.
                </p>
              )}
              {porCurso.map((c, i) => {
                const max = porCurso[0]?.n ?? 1;
                const pct = (c.n / max) * 100;
                const destaque = i === 0;
                return (
                  <div
                    key={c.curso}
                    className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3.5"
                  >
                    <span className="flex items-center gap-1.5 truncate text-sm text-fatec-ink sm:w-44 sm:flex-none">
                      {destaque && (
                        <Trophy
                          className="h-3.5 w-3.5 flex-none text-fatec-orange-500"
                          strokeWidth={1.75}
                        />
                      )}
                      <span className="truncate">{c.curso}</span>
                    </span>
                    <div className="flex items-center gap-3.5 sm:contents">
                      <div className="h-6 flex-1 rounded-xl bg-fatec-navy-50">
                        <div
                          className="flex h-6 items-center justify-end rounded-xl px-2.5"
                          style={{
                            width: `${Math.max(8, pct)}%`,
                            backgroundColor: destaque ? "#ea741c" : "#2376b9",
                          }}
                        >
                          <span className="text-xs font-bold tabular-nums text-white">
                            {c.n}
                          </span>
                        </div>
                      </div>
                      <span className="w-20 flex-none text-right text-xs text-fatec-muted">
                        {c.n} inscrito{c.n === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Presença por dia — só evento simples de mais de 1 dia (ver
              diasDoEvento). Mostra a queda de comparecimento dia a dia,
              proporcional ao total de inscritos. */}
          {ehSimples && presencaPorDia.length > 0 && (
          <div className="mt-6 rounded-2xl border border-fatec-line bg-white p-6">
            <h2 className="text-base font-semibold text-fatec-navy-900">
              Presença por {rotuloDiaSelecionado.toLowerCase()}
            </h2>
            <p className="mt-0.5 text-sm text-fatec-muted">
              Quantos confirmaram presença em cada {rotuloDiaSelecionado.toLowerCase()}, de{" "}
              {totalInscricoes} inscritos
            </p>

            <div className="mt-5 flex flex-col gap-3.5">
              {presencaPorDia.map((d) => {
                const pct = totalInscricoes > 0 ? (d.n / totalInscricoes) * 100 : 0;
                return (
                  <div
                    key={d.dia}
                    className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3.5"
                  >
                    <span className="truncate text-sm text-fatec-ink sm:w-32 sm:flex-none">
                      {d.rotulo}
                    </span>
                    <div className="flex items-center gap-3.5 sm:contents">
                      <div className="h-6 flex-1 rounded-xl bg-fatec-navy-50">
                        <div
                          className="flex h-6 items-center justify-end rounded-xl px-2.5"
                          style={{ width: `${Math.max(8, pct)}%`, backgroundColor: "#2376b9" }}
                        >
                          <span className="text-xs font-bold tabular-nums text-white">{d.n}</span>
                        </div>
                      </div>
                      <span className="w-20 flex-none text-right text-xs text-fatec-muted">
                        {Math.round(pct)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </div>
      </div>
    </main>
  );
}
