"use client";

import { useMemo, useState } from "react";
import { Search, ChevronDown, Send, Minus, Plus, Check, X } from "lucide-react";
import { serverTimestamp, writeBatch, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos } from "@/lib/data/eventos";
import { useTrabalhos, type TrabalhoStatus } from "@/lib/data/trabalhos";
import { useUsuarios, type UsuarioRegistro } from "@/lib/data/usuarios";

type Etapa =
  | "submissao"
  | "avaliacao"
  | "revisao"
  | "resultado"
  | "apresentacao"
  | "resultado_final";

const ETAPAS: { key: Etapa; label: string }[] = [
  { key: "submissao", label: "Submissão" },
  { key: "avaliacao", label: "Avaliação" },
  { key: "revisao", label: "Revisão" },
  { key: "resultado", label: "Resultado" },
  { key: "apresentacao", label: "Apresentação" },
  { key: "resultado_final", label: "Resultado Final" },
];

const STATUS_POR_ETAPA: Record<Etapa, TrabalhoStatus[]> = {
  submissao: ["submissao"],
  avaliacao: ["aguardando_avaliacao"],
  revisao: ["revisao"],
  resultado: ["avaliado"],
  apresentacao: ["aguardando_apresentacao"],
  resultado_final: ["apresentado", "aceito", "nao_aceito"],
};

// Etapas em que a organização seleciona trabalhos e distribui entre pessoas
// (avaliadores na Submissão, moderadores no Resultado) — mesma mecânica nos
// dois casos, só troca o papel-alvo (2026-08-26).
const ETAPA_PARA_PAPEL_ALVO: Partial<Record<Etapa, "avaliador" | "moderador">> = {
  submissao: "avaliador",
  resultado: "moderador",
};

function formatarData(valor: unknown): string {
  if (!valor || typeof valor !== "object" || !("toDate" in valor)) return "—";
  return (valor as { toDate(): Date }).toDate().toLocaleDateString("pt-BR");
}

export default function TrabalhosAdminPage() {
  const { user, perfil, carregando } = useRequireAuth(["admin", "organizacao"]);
  const { eventos } = useEventos(perfil);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const { usuarios } = useUsuarios();

  const [etapa, setEtapaBruta] = useState<Etapa>("submissao");
  const [busca, setBusca] = useState("");
  const [eventoId, setEventoId] = useState("todos");
  const [areaFiltro, setAreaFiltro] = useState("Todas as áreas");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modalEnviar, setModalEnviar] = useState(false);
  const [papelAlvoEnvio, setPapelAlvoEnvio] = useState<"avaliador" | "moderador">("avaliador");
  const [avaliadorEscolhido, setAvaliadorEscolhido] = useState("");
  const [distribuicao, setDistribuicao] = useState<
    { uid: string; nome: string; quantidade: number }[]
  >([]);
  const [modoManual, setModoManual] = useState(false);

  // Seleção não sobrevive troca de etapa (2026-08-25 -> agora tem 2 etapas
  // selecionáveis, Submissão e Resultado, então isso passa a importar de
  // verdade).
  function setEtapa(nova: Etapa) {
    setEtapaBruta(nova);
    setSelecionados(new Set());
  }

  const todosLabel =
    perfil?.papel === "admin" ? "Todos os eventos" : "Todos os meus eventos";

  const areasParaFiltro = useMemo(() => {
    if (eventoId === "todos") {
      const set = new Set<string>();
      for (const e of eventos) (e.areasTematicas ?? []).forEach((a) => set.add(a));
      return Array.from(set).sort();
    }
    return eventos.find((e) => e.id === eventoId)?.areasTematicas ?? [];
  }, [eventos, eventoId]);

  const trabalhosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return trabalhos.filter((t) => {
      const bateEtapa = STATUS_POR_ETAPA[etapa].includes(t.status);
      const bateEvento = eventoId === "todos" || t.eventoId === eventoId;
      const bateArea =
        areaFiltro === "Todas as áreas" || t.areaTematica === areaFiltro;
      const bateBusca =
        !termo ||
        t.titulo.toLowerCase().includes(termo) ||
        t.alunoNome?.toLowerCase().includes(termo);
      return bateEtapa && bateEvento && bateArea && bateBusca;
    });
  }, [trabalhos, busca, eventoId, areaFiltro, etapa]);

  // Orientador pode ser alocado como avaliador de um evento (2026-08-25, RF-46).
  const avaliadoresDisponiveis = useMemo(
    () => usuarios.filter((u) => u.papel === "avaliador" || u.papel === "orientador"),
    [usuarios],
  );

  // Moderadores (2026-08-26) — papel primário "moderador" ou combinado via
  // papeisAvaliacao (ex.: orientador que também modera apresentações).
  const moderadoresDisponiveis = useMemo(
    () => usuarios.filter((u) => u.papel === "moderador" || u.papeisAvaliacao?.includes("moderador")),
    [usuarios],
  );

  const pessoasDisponiveis: UsuarioRegistro[] =
    papelAlvoEnvio === "avaliador" ? avaliadoresDisponiveis : moderadoresDisponiveis;

  // Trabalhos selecionados na etapa Submissão, na mesma ordem da tabela —
  // usada tanto pra descobrir se compartilham evento/área quanto pra fatiar
  // a divisão entre avaliadores em ordem estável.
  const trabalhosSelecionadosObjs = useMemo(
    () => trabalhosFiltrados.filter((t) => selecionados.has(t.id)),
    [trabalhosFiltrados, selecionados],
  );

  const eventoComumSelecionado = useMemo(() => {
    if (trabalhosSelecionadosObjs.length === 0) return null;
    const primeiro = trabalhosSelecionadosObjs[0].eventoId;
    return trabalhosSelecionadosObjs.every((t) => t.eventoId === primeiro)
      ? primeiro
      : null;
  }, [trabalhosSelecionadosObjs]);

  const areaComumSelecionada = useMemo(() => {
    if (trabalhosSelecionadosObjs.length === 0) return null;
    const primeira = trabalhosSelecionadosObjs[0].areaTematica;
    return trabalhosSelecionadosObjs.every((t) => t.areaTematica === primeira)
      ? primeira
      : null;
  }, [trabalhosSelecionadosObjs]);

  // Pessoas (avaliador ou moderador, conforme papelAlvoEnvio) designadas pra
  // essa área nesse evento (ver areasTematicas em AtribuicaoEvento) — só
  // existe divisão automática quando isso não é vazio.
  const pessoasDaArea = useMemo(() => {
    if (!eventoComumSelecionado || !areaComumSelecionada) return [];
    return pessoasDisponiveis.filter((a) =>
      (a.atribuicoesEventos ?? []).some(
        (at) =>
          at.eventoId === eventoComumSelecionado &&
          (at.areasTematicas ?? []).includes(areaComumSelecionada),
      ),
    );
  }, [pessoasDisponiveis, eventoComumSelecionado, areaComumSelecionada]);

  // Fallback do modo manual: pessoas do evento em comum, se alguma; senão,
  // todo mundo cadastrado com esse papel (seleção mistura eventos, ou
  // ninguém foi designado ainda pro evento).
  const pessoasParaManual = useMemo(() => {
    if (!eventoComumSelecionado) return pessoasDisponiveis;
    const doEvento = pessoasDisponiveis.filter((a) =>
      (a.atribuicoesEventos ?? []).some((at) => at.eventoId === eventoComumSelecionado),
    );
    return doEvento.length > 0 ? doEvento : pessoasDisponiveis;
  }, [pessoasDisponiveis, eventoComumSelecionado]);

  function distribuicaoPadrao(
    lista: { uid: string; nome: string }[],
    total: number,
  ): { uid: string; nome: string; quantidade: number }[] {
    const base = Math.floor(total / lista.length);
    const resto = total % lista.length;
    return lista.map((a, i) => ({ ...a, quantidade: base + (i < resto ? 1 : 0) }));
  }

  function abrirModalEnviar(papel: "avaliador" | "moderador") {
    setPapelAlvoEnvio(papel);
    // Recalcula na hora em vez de reaproveitar pessoasDaArea/pessoasParaManual
    // memoizados: setPapelAlvoEnvio só reflete no próximo render, então esses
    // memos ainda estariam com o alvo antigo neste exato ponto do código. A
    // modal em si (JSX abaixo) já usa os memoizados normalmente, porque aí
    // o estado já assentou.
    const disponiveis = papel === "avaliador" ? avaliadoresDisponiveis : moderadoresDisponiveis;
    const daArea = !eventoComumSelecionado || !areaComumSelecionada
      ? []
      : disponiveis.filter((a) =>
          (a.atribuicoesEventos ?? []).some(
            (at) =>
              at.eventoId === eventoComumSelecionado &&
              (at.areasTematicas ?? []).includes(areaComumSelecionada),
          ),
        );
    const paraManual =
      !eventoComumSelecionado
        ? disponiveis
        : (() => {
            const doEvento = disponiveis.filter((a) =>
              (a.atribuicoesEventos ?? []).some((at) => at.eventoId === eventoComumSelecionado),
            );
            return doEvento.length > 0 ? doEvento : disponiveis;
          })();

    setModoManual(daArea.length === 0);
    setDistribuicao(
      daArea.length > 0
        ? distribuicaoPadrao(
            daArea.map((a) => ({ uid: a.uid, nome: a.nome })),
            selecionados.size,
          )
        : [],
    );
    setAvaliadorEscolhido(paraManual[0]?.uid ?? "");
    setModalEnviar(true);
  }

  function ajustarQuantidade(index: number, delta: number) {
    setDistribuicao((prev) =>
      prev.map((linha, i) =>
        i === index
          ? { ...linha, quantidade: Math.max(0, linha.quantidade + delta) }
          : linha,
      ),
    );
  }

  const somaDistribuicao = distribuicao.reduce((acc, l) => acc + l.quantidade, 0);

  const contagem = (e: Etapa) =>
    trabalhos.filter((t) => STATUS_POR_ETAPA[e].includes(t.status)).length;

  function alternarSelecao(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Campos e status gravados mudam conforme o alvo do envio (2026-08-26).
  function camposEnvio(uid: string, nome: string) {
    return papelAlvoEnvio === "avaliador"
      ? { status: "aguardando_avaliacao" as const, avaliadorUid: uid, avaliadorNome: nome }
      : { status: "aguardando_apresentacao" as const, moderadorUid: uid, moderadorNome: nome };
  }

  async function confirmarEnvio() {
    const pessoa = pessoasParaManual.find((a) => a.uid === avaliadorEscolhido);
    if (!pessoa) return;

    const batch = writeBatch(db);
    for (const id of selecionados) {
      batch.update(doc(db, "trabalhos", id), {
        ...camposEnvio(pessoa.uid, pessoa.nome),
        atualizadoEm: serverTimestamp(),
      });
    }
    await batch.commit();
    setSelecionados(new Set());
    setModalEnviar(false);
  }

  async function confirmarEnvioDistribuido() {
    if (somaDistribuicao !== selecionados.size) return;

    const idsOrdenados = trabalhosSelecionadosObjs.map((t) => t.id);
    const batch = writeBatch(db);
    let cursor = 0;
    for (const linha of distribuicao) {
      const fatia = idsOrdenados.slice(cursor, cursor + linha.quantidade);
      cursor += linha.quantidade;
      for (const id of fatia) {
        batch.update(doc(db, "trabalhos", id), {
          ...camposEnvio(linha.uid, linha.nome),
          atualizadoEm: serverTimestamp(),
        });
      }
    }
    await batch.commit();
    setSelecionados(new Set());
    setModalEnviar(false);
  }

  /** Etapa Resultado Final (2026-08-26) — organização confirma aceite,
   * fecha a pendência 8.2 (RF-19). */
  async function decidirResultado(id: string, aceitar: boolean) {
    await updateDoc(doc(db, "trabalhos", id), {
      status: aceitar ? "aceito" : "nao_aceito",
      atualizadoEm: serverTimestamp(),
    });
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/trabalhos"
        userName={perfil.nome}
        userRoleLabel={perfil.papel === "admin" ? "Admin" : "Organização"}
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="flex flex-col gap-4 border-b border-fatec-line bg-white px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Trabalhos
            </h1>
            <p className="text-sm text-fatec-muted">
              Da submissão ao resultado final, em seis etapas.
            </p>
          </div>

          <div className="relative">
            <select
              value={eventoId}
              onChange={(e) => {
                setEventoId(e.target.value);
                setAreaFiltro("Todas as áreas");
              }}
              className="w-full appearance-none rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-fatec-navy-900 outline-none focus:border-fatec-sky-600 md:w-64"
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
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="flex w-fit overflow-hidden rounded-xl border border-fatec-line">
            {ETAPAS.map((e, i) => {
              const ativa = etapa === e.key;
              return (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => setEtapa(e.key)}
                  style={{
                    clipPath:
                      i === ETAPAS.length - 1
                        ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 18px 50%)"
                        : "polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%, 18px 50%)",
                    marginLeft: i === 0 ? 0 : -18,
                  }}
                  className={`relative flex items-center gap-2 py-3 pl-6 pr-8 text-sm font-semibold transition-colors ${
                    ativa
                      ? "z-10 bg-fatec-orange-500 text-white"
                      : "bg-fatec-navy-50 text-fatec-navy-800 hover:bg-fatec-navy-100"
                  }`}
                >
                  {e.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      ativa
                        ? "bg-white/20 text-white"
                        : "bg-white text-fatec-navy-700"
                    }`}
                  >
                    {contagem(e.key)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 rounded-xl border border-fatec-line bg-white px-4 py-2.5 sm:w-64">
                <Search
                  className="h-4 w-4 flex-none text-fatec-muted"
                  strokeWidth={1.75}
                />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por título ou aluno"
                  className="min-w-0 flex-1 bg-transparent text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none"
                />
              </div>

              <div className="relative">
                <select
                  value={areaFiltro}
                  onChange={(e) => setAreaFiltro(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-fatec-navy-900 outline-none focus:border-fatec-sky-600 sm:w-auto"
                >
                  <option value="Todas as áreas">Todas as áreas</option>
                  {areasParaFiltro.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
                  strokeWidth={1.75}
                />
              </div>
            </div>

            {ETAPA_PARA_PAPEL_ALVO[etapa] && (
              <button
                type="button"
                disabled={selecionados.size === 0}
                onClick={() => abrirModalEnviar(ETAPA_PARA_PAPEL_ALVO[etapa]!)}
                className="flex items-center justify-center gap-2 rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
              >
                <Send className="h-4 w-4" strokeWidth={1.75} />
                {ETAPA_PARA_PAPEL_ALVO[etapa] === "avaliador"
                  ? "Enviar para avaliação"
                  : "Enviar para apresentação"}
                {selecionados.size > 0 && ` (${selecionados.size})`}
              </button>
            )}
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-fatec-line bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-fatec-line text-xs uppercase tracking-[-0.01em] text-fatec-muted">
                    {!!ETAPA_PARA_PAPEL_ALVO[etapa] && (
                      <th className="w-10 px-6 py-3">
                        <span className="sr-only">Selecionar</span>
                      </th>
                    )}
                    <th className="px-6 py-3 font-semibold">Trabalho</th>
                    <th className="px-6 py-3 font-semibold">Evento</th>
                    <th className="px-6 py-3 font-semibold">Área temática</th>
                    {etapa !== "submissao" && (
                      <th className="px-6 py-3 font-semibold">Avaliador</th>
                    )}
                    {(etapa === "apresentacao" || etapa === "resultado_final") && (
                      <th className="px-6 py-3 font-semibold">Moderador</th>
                    )}
                    <th className="px-6 py-3 font-semibold">Status</th>
                    {etapa === "resultado" && (
                      <th className="px-6 py-3 font-semibold">Nota avaliador (/25)</th>
                    )}
                    {etapa === "resultado_final" && (
                      <th className="px-6 py-3 font-semibold">Nota final (/50)</th>
                    )}
                    <th className="px-6 py-3 font-semibold">Atualizado</th>
                    {etapa === "resultado_final" && (
                      <th className="px-6 py-3 font-semibold">
                        <span className="sr-only">Ações</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {trabalhosFiltrados.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-fatec-line last:border-0 hover:bg-fatec-navy-50/60"
                    >
                      {!!ETAPA_PARA_PAPEL_ALVO[etapa] && (
                        <td className="px-6 py-4 align-top">
                          <input
                            type="checkbox"
                            checked={selecionados.has(t.id)}
                            onChange={() => alternarSelecao(t.id)}
                            className="h-4 w-4 rounded border-fatec-line text-fatec-orange-500 focus:ring-fatec-orange-500"
                          />
                        </td>
                      )}
                      <td className="max-w-[300px] px-6 py-4 align-top">
                        <p className="line-clamp-2 font-medium leading-snug text-fatec-navy-900">
                          {t.titulo}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-fatec-muted">
                          {t.alunoNome}
                        </p>
                      </td>
                      <td className="px-6 py-4 align-top text-fatec-ink">
                        {eventos.find((e) => e.id === t.eventoId)?.nome ?? t.eventoId}
                      </td>
                      <td className="px-6 py-4 align-top text-fatec-ink">
                        {t.areaTematica}
                      </td>
                      {etapa !== "submissao" && (
                        <td className="px-6 py-4 align-top text-fatec-ink">
                          {t.avaliadorNome ?? "—"}
                        </td>
                      )}
                      {(etapa === "apresentacao" || etapa === "resultado_final") && (
                        <td className="px-6 py-4 align-top text-fatec-ink">
                          {t.moderadorNome ?? "—"}
                        </td>
                      )}
                      <td className="px-6 py-4 align-top">
                        <StatusBadge status={t.status} />
                      </td>
                      {etapa === "resultado" && (
                        <td className="px-6 py-4 align-top font-semibold text-fatec-navy-900">
                          {t.notaAvaliador ?? "—"}
                        </td>
                      )}
                      {etapa === "resultado_final" && (
                        <td className="px-6 py-4 align-top font-semibold text-fatec-navy-900">
                          {typeof t.notaAvaliador === "number" && typeof t.notaModerador === "number"
                            ? t.notaAvaliador + t.notaModerador
                            : "—"}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-6 py-4 align-top text-fatec-muted">
                        {formatarData(t.atualizadoEm)}
                      </td>
                      {etapa === "resultado_final" && (
                        <td className="px-6 py-4 align-top">
                          {t.status === "apresentado" && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                aria-label="Aceitar"
                                onClick={() => decidirResultado(t.id, true)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-50"
                              >
                                <Check className="h-4 w-4" strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                aria-label="Recusar"
                                onClick={() => decidirResultado(t.id, false)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50"
                              >
                                <X className="h-4 w-4" strokeWidth={2} />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}

                  {trabalhosFiltrados.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-10 text-center text-sm text-fatec-muted"
                      >
                        Nenhum trabalho nesta etapa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={modalEnviar}
        onClose={() => setModalEnviar(false)}
        title={papelAlvoEnvio === "avaliador" ? "Enviar para avaliação" : "Enviar para apresentação"}
      >
        <p className="text-sm text-fatec-ink">
          Enviar <span className="font-semibold">{selecionados.size}</span>{" "}
          trabalho(s) selecionado(s) para{" "}
          {papelAlvoEnvio === "avaliador" ? "avaliação" : "apresentação"}.
        </p>

        {!modoManual && pessoasDaArea.length > 0 ? (
          <div className="mt-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-fatec-navy-900">
                Dividir entre os {papelAlvoEnvio === "avaliador" ? "avaliadores" : "moderadores"} de{" "}
                {areaComumSelecionada}
              </span>
              <button
                type="button"
                onClick={() => setModoManual(true)}
                className="flex-none text-xs font-semibold text-fatec-sky-600 hover:text-fatec-navy-800"
              >
                Escolher 1 avaliador manualmente
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {distribuicao.map((linha, i) => (
                <div
                  key={linha.uid}
                  className="flex items-center justify-between gap-3 rounded-xl border border-fatec-line px-4 py-2.5"
                >
                  <span className="truncate text-sm font-medium text-fatec-navy-900">
                    {linha.nome}
                  </span>
                  <div className="flex flex-none items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Diminuir para ${linha.nome}`}
                      onClick={() => ajustarQuantidade(i, -1)}
                      disabled={linha.quantidade <= 0}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-fatec-line text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums text-fatec-navy-900">
                      {linha.quantidade}
                    </span>
                    <button
                      type="button"
                      aria-label={`Aumentar para ${linha.nome}`}
                      onClick={() => ajustarQuantidade(i, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-fatec-line text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p
              className={`text-sm ${
                somaDistribuicao === selecionados.size
                  ? "text-fatec-muted"
                  : "font-medium text-fatec-orange-600"
              }`}
            >
              {somaDistribuicao} / {selecionados.size} trabalhos distribuídos
              {somaDistribuicao !== selecionados.size &&
                " — ajuste os números até bater o total"}
            </p>
          </div>
        ) : (
          <>
            {areaComumSelecionada && pessoasDaArea.length === 0 && (
              <p className="mt-4 text-sm text-fatec-muted">
                Nenhum {papelAlvoEnvio === "avaliador" ? "avaliador" : "moderador"} cadastrado
                para {areaComumSelecionada} neste evento — escolha manualmente.
              </p>
            )}

            <label className="mt-4 flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fatec-navy-900">
                Selecione o {papelAlvoEnvio === "avaliador" ? "avaliador" : "moderador"}
              </span>
              <div className="relative">
                <select
                  value={avaliadorEscolhido}
                  onChange={(e) => setAvaliadorEscolhido(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-fatec-line bg-white py-2.5 pl-4 pr-9 text-sm text-fatec-ink outline-none focus:border-fatec-sky-600"
                >
                  {pessoasParaManual.length === 0 && (
                    <option value="">
                      Nenhum {papelAlvoEnvio === "avaliador" ? "avaliador" : "moderador"} cadastrado
                    </option>
                  )}
                  {pessoasParaManual.map((a) => (
                    <option key={a.uid} value={a.uid}>
                      {a.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fatec-muted"
                  strokeWidth={1.75}
                />
              </div>
            </label>

            {pessoasDaArea.length > 0 && (
              <button
                type="button"
                onClick={() => setModoManual(false)}
                className="mt-2 text-xs font-semibold text-fatec-sky-600 hover:text-fatec-navy-800"
              >
                Voltar pra divisão automática
              </button>
            )}
          </>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setModalEnviar(false)}
            className="rounded-xl border border-fatec-line px-4 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={
              !modoManual && pessoasDaArea.length > 0
                ? confirmarEnvioDistribuido
                : confirmarEnvio
            }
            disabled={
              !modoManual && pessoasDaArea.length > 0
                ? somaDistribuicao !== selecionados.size
                : !avaliadorEscolhido
            }
            className="rounded-xl bg-fatec-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
          >
            Enviar
          </button>
        </div>
      </Modal>
    </main>
  );
}
