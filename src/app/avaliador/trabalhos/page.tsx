"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { serverTimestamp } from "firebase/firestore";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { navParaPerfil } from "@/lib/navAvaliacao";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { temPapel } from "@/lib/auth";
import { useEventos, type Evento } from "@/lib/data/eventos";
import {
  useTrabalhos,
  atualizarTrabalho,
  type NotasCriterios,
  type NotasCriteriosApresentacao,
  type Trabalho,
  type TrabalhoStatus,
} from "@/lib/data/trabalhos";

const TODOS_MEUS_EVENTOS = "Todos os meus eventos";
const NOTAS = [1, 2, 3, 4, 5];

type CriterioDef = { key: string; label: string };

// Critérios do edital do evento (item 6.1) — cada um recebe nota de 1 a 5
// (item 6.2); a nota final somada é o que ranqueia os resumos mais bem
// pontuados.
const CRITERIOS_AVALIACAO: CriterioDef[] = [
  { key: "suficiencia", label: "Suficiência" },
  { key: "coerencia", label: "Coerência" },
  { key: "estruturaTexto", label: "Estrutura do texto" },
  { key: "clarezaPrecisao", label: "Clareza e precisão" },
  { key: "aplicabilidadeRelevancia", label: "Aplicabilidade e relevância" },
];

// Critérios da etapa de Apresentação (2026-08-26) — PROVISÓRIO, o usuário
// ainda não passou a lista real; trocar aqui quando ele mandar (mesmo
// formato: 1 a 5 cada, soma 5-25 — ver NotasCriteriosApresentacao).
const CRITERIOS_APRESENTACAO: CriterioDef[] = [
  { key: "dominioConteudo", label: "Domínio do conteúdo" },
  { key: "clarezaComunicacao", label: "Clareza da comunicação" },
  { key: "usoDoTempo", label: "Uso do tempo" },
  { key: "qualidadeMaterial", label: "Qualidade do material/slides" },
  { key: "posturaSeguranca", label: "Postura e segurança" },
];

/** Lista + formulário de nota (5 critérios, 1 a 5 cada) reaproveitado tanto
 * pela aba Avaliação (avaliador) quanto pela aba Apresentação (moderador,
 * 2026-08-26) — só muda a lista de trabalhos, os critérios e o que
 * acontece ao enviar/pedir revisão. */
function PainelTrabalhos({
  trabalhos,
  eventos,
  criterios,
  statusPendente,
  mensagemVazia,
  permiteRevisao,
  onEnviarNota,
  onSolicitarRevisao,
}: {
  trabalhos: Trabalho[];
  eventos: Evento[];
  criterios: CriterioDef[];
  statusPendente: TrabalhoStatus;
  mensagemVazia: string;
  permiteRevisao: boolean;
  onEnviarNota: (id: string, soma: number, notas: Record<string, number>) => void;
  onSolicitarRevisao?: (id: string, comentario: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [eventoId, setEventoId] = useState(TODOS_MEUS_EVENTOS);
  const [avaliando, setAvaliando] = useState<string | null>(null);
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [pedindoRevisao, setPedindoRevisao] = useState(false);
  const [comentarioRevisao, setComentarioRevisao] = useState("");

  const somaNotas = criterios.reduce((acc, c) => acc + (notas[c.key] ?? 0), 0);
  const notasCompletas = criterios.every((c) => notas[c.key]);

  const trabalhosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return trabalhos.filter((t) => {
      const bateEvento = eventoId === TODOS_MEUS_EVENTOS || t.eventoId === eventoId;
      const bateBusca =
        !termo ||
        t.titulo.toLowerCase().includes(termo) ||
        t.alunoNome?.toLowerCase().includes(termo);
      return bateEvento && bateBusca;
    });
  }, [busca, eventoId, trabalhos]);

  function abrirAvaliacao(id: string) {
    setAvaliando((cur) => (cur === id ? null : id));
    setNotas({});
    setPedindoRevisao(false);
    setComentarioRevisao("");
  }

  function enviar(id: string) {
    if (!notasCompletas) return;
    onEnviarNota(id, somaNotas, notas);
    setAvaliando(null);
    setNotas({});
  }

  function enviarRevisao(id: string) {
    if (!comentarioRevisao.trim() || !onSolicitarRevisao) return;
    onSolicitarRevisao(id, comentarioRevisao.trim());
    setAvaliando(null);
    setPedindoRevisao(false);
    setComentarioRevisao("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-xl border border-fatec-line bg-white px-4 py-2.5 sm:max-w-sm sm:flex-1">
          <Search className="h-4 w-4 flex-none text-fatec-muted" strokeWidth={1.75} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título ou nome do aluno"
            className="min-w-0 flex-1 bg-transparent text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none"
          />
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
      </div>

      {trabalhosFiltrados.length === 0 && (
        <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
          {mensagemVazia}
        </p>
      )}

      {trabalhosFiltrados.map((t) => (
        <div key={t.id} className="rounded-2xl border border-fatec-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-fatec-navy-900">{t.titulo}</p>
              <p className="text-sm text-fatec-muted">
                {t.alunoNome} · {eventos.find((e) => e.id === t.eventoId)?.nome ?? t.eventoId}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={t.status} />
              {t.status === statusPendente && (
                <button
                  type="button"
                  onClick={() => abrirAvaliacao(t.id)}
                  className="rounded-lg bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                >
                  {avaliando === t.id ? "Fechar" : "Avaliar"}
                </button>
              )}
            </div>
          </div>

          {avaliando === t.id && (
            <div className="mt-5 flex flex-col gap-4 border-t border-fatec-line pt-5">
              {t.resumo && <p className="text-sm leading-relaxed text-fatec-ink">{t.resumo}</p>}

              {!pedindoRevisao ? (
                <>
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-medium text-fatec-navy-900">
                      Critérios (1 a 5 cada — a nota final é a soma)
                    </span>
                    {criterios.map((c) => (
                      <div
                        key={c.key}
                        className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="text-sm text-fatec-ink">{c.label}</span>
                        <div className="flex gap-2">
                          {NOTAS.map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setNotas((prev) => ({ ...prev, [c.key]: n }))}
                              className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${
                                notas[c.key] === n
                                  ? "border-fatec-orange-500 bg-fatec-orange-500 text-white"
                                  : "border-fatec-line text-fatec-navy-900 hover:border-fatec-orange-500/60"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <p className="text-sm text-fatec-muted">
                      Total:{" "}
                      <span className="font-semibold text-fatec-navy-900">{somaNotas}</span> / 25
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => enviar(t.id)}
                      disabled={!notasCompletas}
                      className="rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
                    >
                      Enviar nota
                    </button>
                    {permiteRevisao && (
                      <button
                        type="button"
                        onClick={() => setPedindoRevisao(true)}
                        className="rounded-xl border border-fatec-line px-6 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                      >
                        Solicitar revisão
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-fatec-navy-900">
                      O que o aluno precisa revisar?
                    </span>
                    <textarea
                      rows={3}
                      value={comentarioRevisao}
                      onChange={(e) => setComentarioRevisao(e.target.value)}
                      placeholder="Explique o que precisa ser ajustado antes de reenviar"
                      className="resize-none rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => enviarRevisao(t.id)}
                      disabled={!comentarioRevisao.trim()}
                      className="rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
                    >
                      Enviar solicitação
                    </button>
                    <button
                      type="button"
                      onClick={() => setPedindoRevisao(false)}
                      className="rounded-xl border border-fatec-line px-6 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                    >
                      Voltar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AvaliadorTrabalhosPage() {
  const { user, perfil, carregando } = useRequireAuth(["avaliador", "moderador"]);
  const { eventos } = useEventos(perfil);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const [abaAtiva, setAbaAtiva] = useState<"avaliacao" | "apresentacao">("avaliacao");

  const souAvaliador = temPapel(perfil, "avaliador") || temPapel(perfil, "orientador");
  const souModerador = temPapel(perfil, "moderador");

  const trabalhosAvaliacao = useMemo(
    () => trabalhos.filter((t) => t.avaliadorUid === user?.uid),
    [trabalhos, user?.uid],
  );
  const trabalhosApresentacao = useMemo(
    () => trabalhos.filter((t) => t.moderadorUid === user?.uid),
    [trabalhos, user?.uid],
  );

  if (carregando || !perfil) return null;

  const mostrarAbas = souAvaliador && souModerador;
  const abaVisivel = mostrarAbas ? abaAtiva : souModerador ? "apresentacao" : "avaliacao";

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navParaPerfil(perfil)}
        activeHref="/avaliador/trabalhos"
        userName={perfil.nome}
        userRoleLabel="Avaliador"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Trabalhos
          </h1>
          <p className="text-sm text-fatec-muted">
            {abaVisivel === "avaliacao"
              ? "Trabalhos que a organização enviou para você avaliar."
              : "Trabalhos que a organização enviou para você moderar a apresentação."}
          </p>

          {mostrarAbas && (
            <div className="mt-4 flex w-fit gap-1 rounded-xl bg-fatec-navy-50 p-1">
              <button
                type="button"
                onClick={() => setAbaAtiva("avaliacao")}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  abaAtiva === "avaliacao"
                    ? "bg-white text-fatec-navy-900 shadow-sm"
                    : "text-fatec-muted hover:text-fatec-navy-900"
                }`}
              >
                Avaliação
              </button>
              <button
                type="button"
                onClick={() => setAbaAtiva("apresentacao")}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  abaAtiva === "apresentacao"
                    ? "bg-white text-fatec-navy-900 shadow-sm"
                    : "text-fatec-muted hover:text-fatec-navy-900"
                }`}
              >
                Apresentação
              </button>
            </div>
          )}
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {abaVisivel === "avaliacao" ? (
            <PainelTrabalhos
              trabalhos={trabalhosAvaliacao}
              eventos={eventos}
              criterios={CRITERIOS_AVALIACAO}
              statusPendente="aguardando_avaliacao"
              mensagemVazia="Nenhum trabalho designado a você ainda."
              permiteRevisao
              onEnviarNota={(id, soma, notas) =>
                atualizarTrabalho(id, {
                  status: "avaliado",
                  notasCriterios: notas as unknown as NotasCriterios,
                  notaAvaliador: soma,
                  atualizadoEm: serverTimestamp(),
                })
              }
              onSolicitarRevisao={(id, comentario) =>
                atualizarTrabalho(id, {
                  status: "revisao",
                  comentarioRevisao: comentario,
                  atualizadoEm: serverTimestamp(),
                })
              }
            />
          ) : (
            <PainelTrabalhos
              trabalhos={trabalhosApresentacao}
              eventos={eventos}
              criterios={CRITERIOS_APRESENTACAO}
              statusPendente="aguardando_apresentacao"
              mensagemVazia="Nenhum trabalho designado a você ainda."
              permiteRevisao={false}
              onEnviarNota={(id, soma, notas) =>
                atualizarTrabalho(id, {
                  status: "apresentado",
                  notasCriteriosApresentacao: notas as unknown as NotasCriteriosApresentacao,
                  notaModerador: soma,
                  atualizadoEm: serverTimestamp(),
                })
              }
            />
          )}
        </div>
      </div>
    </main>
  );
}
