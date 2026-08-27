"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, CheckCircle2, Megaphone } from "lucide-react";
import { db } from "@/lib/firebase";
import { Sidebar } from "@/components/Sidebar";
import {
  SubmeterTrabalhoModal,
  type DadosSubmissao,
} from "@/components/SubmeterTrabalhoModal";
import { navAlunoPara } from "@/lib/navAluno";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventosPublicos } from "@/lib/data/eventos";
import {
  corrigirTurmaTrabalho,
  submeterTurmaTrabalho,
  useMeuTurmaTrabalho,
  useTurma,
  type TurmaTrabalho,
} from "@/lib/data/turmas";

function formatarData(valor: number): string {
  return new Date(valor).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Componente próprio (com seu próprio estado, inicializado do trabalho atual)
// pra corrigir e reenviar — extraído pra não depender de defaultValue não
// sincronizado com o estado usado no envio (bug: reenviar não fazia nada
// quando o aluno não retocava o título, só o resumo).
function CorrecaoTurmaTrabalhoForm({ trabalho }: { trabalho: TurmaTrabalho }) {
  const [titulo, setTitulo] = useState(trabalho.titulo);
  const [resumo, setResumo] = useState(trabalho.resumo ?? "");
  const [enviando, setEnviando] = useState(false);

  async function reenviar() {
    if (!titulo.trim()) return;
    setEnviando(true);
    try {
      await corrigirTurmaTrabalho(trabalho.id, { titulo: titulo.trim(), resumo: resumo.trim() });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-4">
      {trabalho.comentarioOrientador && (
        <div className="rounded-xl bg-fatec-orange-50 px-4 py-3">
          <p className="text-sm font-medium text-fatec-orange-700">
            O que o orientador pediu pra ajustar
          </p>
          <p className="mt-1 text-sm text-fatec-ink">{trabalho.comentarioOrientador}</p>
        </div>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fatec-navy-900">Título do trabalho</span>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fatec-navy-900">Resumo</span>
        <textarea
          rows={5}
          value={resumo}
          onChange={(e) => setResumo(e.target.value)}
          className="resize-none rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
        />
      </label>
      <button
        type="button"
        onClick={reenviar}
        disabled={enviando || !titulo.trim()}
        className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
      >
        {enviando ? "Enviando..." : "Reenviar"}
      </button>
    </div>
  );
}

export default function TurmaAlunoPage() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const { user, perfil, carregando } = useRequireAuth(["aluno"]);
  const { turma } = useTurma(turmaId);
  const { trabalho } = useMeuTurmaTrabalho(turmaId, user?.uid);
  const { eventos: todosEventos } = useEventosPublicos();

  const [titulo, setTitulo] = useState("");
  const [resumo, setResumo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [eventoEscolhidoId, setEventoEscolhidoId] = useState("");
  const [modalInscricao, setModalInscricao] = useState(false);

  const eventosElegiveis = useMemo(
    () =>
      perfil?.vinculoFatec === false
        ? todosEventos.filter((e) => e.aceitaExternos)
        : todosEventos,
    [todosEventos, perfil],
  );
  const eventoEscolhido = eventosElegiveis.find((e) => e.id === eventoEscolhidoId);

  async function enviarTrabalho() {
    if (!turma || !user || !perfil || !titulo.trim()) return;
    setEnviando(true);
    try {
      await submeterTurmaTrabalho({
        turmaId: turma.id,
        titulo: titulo.trim(),
        resumo: resumo.trim(),
        alunoUid: user.uid,
        alunoNome: perfil.nome,
      });
      setTitulo("");
      setResumo("");
    } finally {
      setEnviando(false);
    }
  }

  async function enviarInscricao(dados: DadosSubmissao) {
    if (!eventoEscolhido || !user || !perfil) return;
    await addDoc(collection(db, "trabalhos"), {
      ...dados,
      eventoId: eventoEscolhido.id,
      alunoUid: user.uid,
      alunoNome: perfil.nome,
      status: "submissao",
      convitesPendentes: dados.participantesUids,
      atualizadoEm: serverTimestamp(),
    });
    setModalInscricao(false);
  }

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navAlunoPara(perfil.vinculoFatec)}
        activeHref="/aluno/projeto-integrador"
        userName={perfil.nome}
        userRoleLabel="Aluno"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <Link
            href="/aluno/projeto-integrador"
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
            <section className="lg:col-span-2">
              <div className="rounded-2xl border border-fatec-line bg-white p-5">
                <h2 className="text-sm font-semibold text-fatec-navy-900">Meu trabalho</h2>

                {!trabalho && (
                  <div className="mt-3 flex flex-col gap-4">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-fatec-navy-900">
                        Título do trabalho <span className="text-fatec-orange-600">*</span>
                      </span>
                      <input
                        type="text"
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                        className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-fatec-navy-900">Resumo</span>
                      <textarea
                        rows={5}
                        value={resumo}
                        onChange={(e) => setResumo(e.target.value)}
                        className="resize-none rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={enviarTrabalho}
                      disabled={enviando || !titulo.trim()}
                      className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
                    >
                      {enviando ? "Enviando..." : "Enviar trabalho"}
                    </button>
                  </div>
                )}

                {trabalho?.status === "aguardando_avaliacao" && (
                  <div className="mt-3 flex flex-col gap-2">
                    <p className="rounded-xl bg-fatec-navy-50 px-4 py-2.5 text-sm text-fatec-ink">
                      Enviado — aguardando avaliação do orientador.
                    </p>
                    <p className="font-medium text-fatec-navy-900">{trabalho.titulo}</p>
                    {trabalho.resumo && (
                      <p className="text-sm text-fatec-muted">{trabalho.resumo}</p>
                    )}
                  </div>
                )}

                {trabalho?.status === "revisao" && (
                  <CorrecaoTurmaTrabalhoForm trabalho={trabalho} />
                )}

                {trabalho?.status === "aprovado" && (
                  <div className="mt-3 flex flex-col gap-4">
                    <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 flex-none" strokeWidth={2} />
                      Aprovado pelo orientador — {trabalho.titulo}
                    </p>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-fatec-navy-900">
                        Inscrever em qual evento?
                      </span>
                      <select
                        value={eventoEscolhidoId}
                        onChange={(e) => setEventoEscolhidoId(e.target.value)}
                        className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none transition-colors focus:border-fatec-sky-600"
                      >
                        <option value="" disabled>
                          Selecione o evento
                        </option>
                        {eventosElegiveis.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.nome}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => setModalInscricao(true)}
                      disabled={!eventoEscolhido}
                      className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
                    >
                      Inscrever em evento
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="rounded-2xl border border-fatec-line bg-white p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-fatec-navy-900">
                  <Megaphone className="h-4 w-4" strokeWidth={1.75} />
                  Mural da turma
                </h2>
                <div className="mt-3 flex flex-col gap-3">
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
            </section>
          </div>
        </div>
      </div>

      {eventoEscolhido && (
        <SubmeterTrabalhoModal
          open={modalInscricao}
          eventoId={eventoEscolhido.id}
          temTaxa={!!eventoEscolhido.valorInscricao}
          eventoNome={eventoEscolhido.nome}
          areasDisponiveis={eventoEscolhido.areasTematicas ?? []}
          meuUid={user?.uid}
          valoresIniciais={{ titulo: trabalho?.titulo, resumo: trabalho?.resumo }}
          onClose={() => setModalInscricao(false)}
          onSubmit={enviarInscricao}
        />
      )}
    </main>
  );
}
