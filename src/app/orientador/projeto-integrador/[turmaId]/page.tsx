"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Megaphone, Search, UserPlus } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { navParaPerfil } from "@/lib/navAvaliacao";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useAlunosParaBusca } from "@/lib/data/usuarios";
import {
  aprovarTurmaTrabalho,
  convidarAlunoTurma,
  postarMural,
  solicitarRevisaoTurmaTrabalho,
  useTurma,
  useTurmaTrabalhos,
  type TurmaTrabalho,
  type TurmaTrabalhoStatus,
} from "@/lib/data/turmas";
import { notificarConviteTurma } from "@/lib/notificarEmail";

const ETAPAS: { key: TurmaTrabalhoStatus; label: string }[] = [
  { key: "aguardando_avaliacao", label: "Aguardando avaliação" },
  { key: "revisao", label: "Revisão" },
  { key: "aprovado", label: "Aprovados" },
];

function formatarData(valor: number): string {
  return new Date(valor).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TurmaOrientadorPage() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const { user, perfil, carregando } = useRequireAuth(["orientador"]);
  const { turma } = useTurma(turmaId);
  const { trabalhos } = useTurmaTrabalhos(turmaId);
  const alunos = useAlunosParaBusca(user?.uid, { apenasFatec: true });

  const [buscaAluno, setBuscaAluno] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [postando, setPostando] = useState(false);
  const [etapa, setEtapa] = useState<TurmaTrabalhoStatus>("aguardando_avaliacao");
  const [avaliando, setAvaliando] = useState<string | null>(null);
  const [pedindoRevisao, setPedindoRevisao] = useState(false);
  const [comentario, setComentario] = useState("");

  const jaConvidados = new Set(turma?.alunosUids ?? []);
  const sugestoes = useMemo(() => {
    const termo = buscaAluno.trim().toLowerCase();
    if (!termo) return [];
    return alunos
      .filter(
        (a) =>
          !jaConvidados.has(a.uid) &&
          (a.nome.toLowerCase().includes(termo) || a.email.toLowerCase().includes(termo)),
      )
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunos, buscaAluno, turma]);

  const trabalhosDaEtapa = trabalhos.filter((t) => t.status === etapa);

  function abrirAvaliacao(id: string) {
    setAvaliando((cur) => (cur === id ? null : id));
    setPedindoRevisao(false);
    setComentario("");
  }

  async function aprovar(id: string) {
    await aprovarTurmaTrabalho(id);
    setAvaliando(null);
  }

  async function enviarRevisao(id: string) {
    if (!comentario.trim()) return;
    await solicitarRevisaoTurmaTrabalho(id, comentario);
    setAvaliando(null);
    setPedindoRevisao(false);
    setComentario("");
  }

  async function convidar(aluno: { uid: string; nome: string }) {
    if (!turma || !user) return;
    await convidarAlunoTurma(turma, aluno);
    notificarConviteTurma(user, turma.id, aluno.uid);
    setBuscaAluno("");
  }

  async function postar() {
    if (!turma || !mensagem.trim()) return;
    setPostando(true);
    try {
      await postarMural(turma, mensagem);
      setMensagem("");
    } finally {
      setPostando(false);
    }
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navParaPerfil(perfil)}
        activeHref="/orientador/projeto-integrador"
        userName={perfil.nome}
        userRoleLabel="Orientador"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <Link
            href="/orientador/projeto-integrador"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-fatec-muted hover:text-fatec-navy-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Projeto Integrador
          </Link>
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            {turma?.nome ?? "Turma"}
          </h1>
          {turma?.disciplina && <p className="text-sm text-fatec-muted">{turma.disciplina}</p>}
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="flex flex-col gap-3 lg:col-span-2">
              <div className="rounded-2xl border border-fatec-line bg-white p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-fatec-navy-900">
                  <Megaphone className="h-4 w-4" strokeWidth={1.75} />
                  Mural da turma
                </h2>
                <div className="mt-3 flex flex-col gap-2">
                  <textarea
                    rows={2}
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder="Deixar um aviso ou lembrete para a turma"
                    className="resize-none rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
                  />
                  <button
                    type="button"
                    onClick={postar}
                    disabled={postando || !mensagem.trim()}
                    className="w-fit rounded-xl bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
                  >
                    {postando ? "Publicando..." : "Publicar aviso"}
                  </button>
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-fatec-line pt-4">
                  {[...(turma?.mensagens ?? [])].reverse().map((m, i) => (
                    <div key={i} className="rounded-xl bg-fatec-navy-50 px-4 py-3">
                      <p className="text-sm text-fatec-ink">{m.texto}</p>
                      <p className="mt-1 text-xs text-fatec-muted">{formatarData(m.criadoEm)}</p>
                    </div>
                  ))}
                  {(turma?.mensagens ?? []).length === 0 && (
                    <p className="text-sm text-fatec-muted">Nenhum aviso publicado ainda.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-fatec-line bg-white p-5">
                <div className="flex w-fit overflow-hidden rounded-xl border border-fatec-line">
                  {ETAPAS.map((e) => {
                    const ativa = etapa === e.key;
                    return (
                      <button
                        key={e.key}
                        type="button"
                        onClick={() => setEtapa(e.key)}
                        className={`px-4 py-2 text-sm font-semibold transition-colors ${
                          ativa
                            ? "bg-fatec-orange-500 text-white"
                            : "bg-white text-fatec-navy-800 hover:bg-fatec-navy-50"
                        }`}
                      >
                        {e.label} ({trabalhos.filter((t) => t.status === e.key).length})
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  {trabalhosDaEtapa.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-fatec-line px-6 py-10 text-center text-sm text-fatec-muted">
                      Nenhum trabalho nesta etapa.
                    </p>
                  )}
                  {trabalhosDaEtapa.map((t: TurmaTrabalho) => (
                    <div key={t.id} className="rounded-2xl border border-fatec-line p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-fatec-navy-900">{t.titulo}</p>
                          <p className="text-sm text-fatec-muted">{t.alunoNome}</p>
                        </div>
                        {etapa === "aguardando_avaliacao" && (
                          <button
                            type="button"
                            onClick={() => abrirAvaliacao(t.id)}
                            className="rounded-lg bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                          >
                            {avaliando === t.id ? "Fechar" : "Avaliar"}
                          </button>
                        )}
                      </div>

                      {etapa === "revisao" && t.comentarioOrientador && (
                        <p className="mt-3 rounded-xl bg-fatec-orange-50 px-4 py-2.5 text-sm text-fatec-ink">
                          {t.comentarioOrientador}
                        </p>
                      )}

                      {avaliando === t.id && (
                        <div className="mt-4 flex flex-col gap-3 border-t border-fatec-line pt-4">
                          {t.resumo && (
                            <p className="text-sm leading-relaxed text-fatec-ink">{t.resumo}</p>
                          )}

                          {!pedindoRevisao ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => aprovar(t.id)}
                                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition-colors hover:bg-emerald-700"
                              >
                                Aprovado
                              </button>
                              <button
                                type="button"
                                onClick={() => setPedindoRevisao(true)}
                                className="rounded-xl border border-fatec-line px-6 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                              >
                                Pedir revisão
                              </button>
                            </div>
                          ) : (
                            <>
                              <label className="flex flex-col gap-1.5">
                                <span className="text-sm font-medium text-fatec-navy-900">
                                  O que precisa ser ajustado?
                                </span>
                                <textarea
                                  rows={3}
                                  value={comentario}
                                  onChange={(e) => setComentario(e.target.value)}
                                  placeholder="Explique o que o aluno precisa corrigir"
                                  className="resize-none rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
                                />
                              </label>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => enviarRevisao(t.id)}
                                  disabled={!comentario.trim()}
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
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="rounded-2xl border border-fatec-line bg-white p-5">
                <h2 className="text-sm font-semibold text-fatec-navy-900">Convidar aluno</h2>
                <div className="relative mt-3">
                  <div className="flex items-center gap-2 rounded-xl border border-fatec-line bg-white px-4 py-2.5">
                    <Search className="h-4 w-4 flex-none text-fatec-muted" strokeWidth={1.75} />
                    <input
                      value={buscaAluno}
                      onChange={(e) => setBuscaAluno(e.target.value)}
                      placeholder="Nome ou e-mail do aluno da Fatec"
                      className="min-w-0 flex-1 bg-transparent text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none"
                    />
                  </div>
                  {sugestoes.length > 0 && (
                    <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-fatec-line bg-white shadow-lg">
                      {sugestoes.map((a) => (
                        <button
                          key={a.uid}
                          type="button"
                          onClick={() => convidar(a)}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-fatec-navy-50"
                        >
                          <UserPlus
                            className="h-4 w-4 flex-none text-fatec-muted"
                            strokeWidth={1.75}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-fatec-navy-900">
                              {a.nome}
                            </span>
                            <span className="block truncate text-xs text-fatec-muted">
                              {a.email}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-fatec-line bg-white p-5">
                <h2 className="text-sm font-semibold text-fatec-navy-900">Alunos</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {(turma?.alunosUids ?? []).map((uid, i) => {
                    const nome = turma?.alunosNomes?.[i] ?? uid;
                    const pendente = turma?.convitesPendentesUids?.includes(uid);
                    return (
                      <div
                        key={uid}
                        className="flex items-center justify-between gap-2 rounded-xl bg-fatec-navy-50 px-3.5 py-2.5"
                      >
                        <span className="truncate text-sm text-fatec-ink">{nome}</span>
                        {pendente && (
                          <span className="flex-none rounded-full bg-fatec-orange-100 px-2 py-0.5 text-xs font-medium text-fatec-orange-600">
                            Convite pendente
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {(turma?.alunosUids ?? []).length === 0 && (
                    <p className="text-sm text-fatec-muted">Nenhum aluno convidado ainda.</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
