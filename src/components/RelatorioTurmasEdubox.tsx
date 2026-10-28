"use client";

import { Fragment, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, CircleAlert, CircleX, Download, Loader2, RefreshCw } from "lucide-react";
import type { User } from "firebase/auth";
import { baixarRelatorioTurmas } from "@/lib/baixarCertificado";
import { ROTULO_STATUS_TRABALHO } from "@/lib/relatorioCursos";
import { ROTULO_SITUACAO, type CursoTurmas, type SituacaoNoEvento } from "@/lib/relatorioTurmas";
import { tituloExibicao } from "@/lib/tituloTrabalho";

const ESTILO_SITUACAO: Record<SituacaoNoEvento, { cor: string; Icone: typeof CheckCircle2 }> = {
  nao_inscrito: { cor: "text-rose-700", Icone: CircleX },
  inscrito_sem_trabalho: { cor: "text-amber-700", Icone: CircleAlert },
  com_trabalho: { cor: "text-emerald-700", Icone: CheckCircle2 },
};

/** Participação por TURMA do Edubox (2026-10-28, pedido explícito do usuário
 * — "bater com o relatório do Edubox que tem as turmas e os alunos ativos").
 * Carrega sob demanda (botão) pra não gastar leitura à toa — cada carga lê as
 * inscrições/trabalhos do evento e os perfis no servidor
 * (/api/relatorios/turmas-edubox). "Atualizar" busca de novo. Tudo aparece
 * na tela ("Ver" abre as turmas do curso logo abaixo); PDF é só pra entregar. */
export function RelatorioTurmasEdubox({ user, eventoId }: { user: User | null | undefined; eventoId: string }) {
  const [dados, setDados] = useState<{
    semestres: string[];
    cursos: CursoTurmas[];
    inscritosForaDoEdubox: number;
    carregadoEm: string;
  } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [gerando, setGerando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    if (!user) return;
    setErro(null);
    setCarregando(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/relatorios/turmas-edubox?eventoId=${encodeURIComponent(eventoId)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const corpo = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(corpo?.erro ?? "Não foi possível carregar as turmas do Edubox.");
      } else {
        setDados({
          ...corpo,
          carregadoEm: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        });
      }
    } catch {
      setErro("Não foi possível carregar as turmas do Edubox.");
    }
    setCarregando(false);
  }

  async function gerarPdf(curso?: string) {
    if (!user) return;
    setErro(null);
    setGerando(curso ?? "__todos__");
    const r = await baixarRelatorioTurmas(user, { eventoId, curso });
    if (!r.ok) setErro(r.erro);
    setGerando(null);
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-fatec-line bg-white p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-fatec-navy-900">Por turma (alunos ativos no Edubox)</h2>
          <p className="text-sm text-fatec-muted">
            Cruza cada turma ativa do Edubox com o evento: quem não se inscreveu, quem se inscreveu e ainda não
            enviou trabalho e quem já enviou.
            {dados
              ? ` Semestres ${dados.semestres.join(", ")} · carregado às ${dados.carregadoEm}. Clique em Ver para abrir as turmas.`
              : " Clique em Carregar turmas para ver aqui na tela."}
          </p>
        </div>
        <div className="flex flex-none gap-2">
          <button
            type="button"
            onClick={carregar}
            disabled={carregando}
            className="flex items-center gap-1.5 rounded-xl border border-fatec-line px-4 py-2 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {dados ? "Atualizar" : "Carregar turmas"}
          </button>
          {dados && (
            <button
              type="button"
              onClick={() => gerarPdf()}
              disabled={gerando !== null || dados.cursos.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-fatec-line px-4 py-2 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted"
            >
              {gerando === "__todos__" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              PDF de todos
            </button>
          )}
        </div>
      </div>

      {erro && <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{erro}</p>}

      {dados && (
        <>
          {dados.inscritosForaDoEdubox > 0 && (
            <p className="text-xs text-fatec-muted">
              {dados.inscritosForaDoEdubox} inscrito(s) no evento não aparecem nas turmas ativas (externos,
              egressos ou CPF diferente no cadastro) — eles estão na tabela de participantes por curso acima.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fatec-line text-left text-xs uppercase tracking-wide text-fatec-muted">
                  <th className="py-2 pr-3 font-semibold">Curso (Edubox)</th>
                  <th className="px-2 py-2 text-right font-semibold">Turmas</th>
                  <th className="px-2 py-2 text-right font-semibold">Ativos</th>
                  <th className="px-2 py-2 text-right font-semibold">Inscritos</th>
                  <th className="px-2 py-2 text-right font-semibold">Enviaram trabalho</th>
                  <th className="px-2 py-2 text-right font-semibold">Não inscritos</th>
                  <th className="py-2 pl-2" />
                </tr>
              </thead>
              <tbody>
                {dados.cursos.map((c) => {
                  const estaAberto = aberto === c.curso;
                  return (
                    <Fragment key={c.curso}>
                      <tr className={`border-b border-fatec-line ${estaAberto ? "bg-fatec-navy-50" : ""}`}>
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            onClick={() => setAberto(estaAberto ? null : c.curso)}
                            className="text-left font-medium text-fatec-navy-900 hover:text-fatec-sky-600"
                          >
                            {c.curso}
                          </button>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{c.turmas.length}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{c.resumo.ativos}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{c.resumo.inscritos}</td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums text-emerald-700">
                          {c.resumo.comTrabalho}
                        </td>
                        <td
                          className={`px-2 py-2 text-right tabular-nums ${c.resumo.naoInscritos > 0 ? "font-semibold text-rose-700" : ""}`}
                        >
                          {c.resumo.naoInscritos}
                        </td>
                        <td className="whitespace-nowrap py-2 pl-2 text-right">
                          <button
                            type="button"
                            onClick={() => setAberto(estaAberto ? null : c.curso)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
                          >
                            {estaAberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            {estaAberto ? "Fechar" : "Ver"}
                          </button>
                          <button
                            type="button"
                            onClick={() => gerarPdf(c.curso)}
                            disabled={gerando !== null}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-fatec-sky-600 transition-colors hover:bg-fatec-sky-100 disabled:text-fatec-muted"
                          >
                            {gerando === c.curso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            PDF
                          </button>
                        </td>
                      </tr>
                      {estaAberto && (
                        <tr className="border-b border-fatec-line">
                          <td colSpan={7} className="bg-fatec-navy-50/40 px-3 py-4">
                            <TurmasDoCurso curso={c} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function TurmasDoCurso({ curso }: { curso: CursoTurmas }) {
  return (
    <div className="flex flex-col gap-5">
      {curso.turmas.map((t) => (
        <div key={t.turma} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-fatec-navy-900">
            {t.nome}
            {t.periodo ? ` — ${t.periodo}º período` : ""}{" "}
            <span className="font-normal text-fatec-muted">· {t.resumo.ativos} ativos · {t.resumo.inscritos} inscritos ·</span>{" "}
            <span className="text-emerald-700">{t.resumo.comTrabalho} enviaram trabalho</span>{" "}
            <span className="font-normal text-fatec-muted">·</span>{" "}
            <span className="text-rose-700">{t.resumo.naoInscritos} não se inscreveram</span>
          </h3>
          <div className="overflow-x-auto rounded-xl border border-fatec-line bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fatec-line text-left text-xs uppercase tracking-wide text-fatec-muted">
                  <th className="px-3 py-2 font-semibold">Aluno</th>
                  <th className="px-2 py-2 font-semibold">Situação no evento</th>
                  <th className="px-3 py-2 font-semibold">Trabalho enviado</th>
                </tr>
              </thead>
              <tbody>
                {t.alunos.map((a) => {
                  const { cor, Icone } = ESTILO_SITUACAO[a.situacao];
                  return (
                    <tr key={a.ra} className="border-b border-fatec-line last:border-0 align-top">
                      <td className="px-3 py-1.5">
                        <span className="font-medium text-fatec-navy-900">{a.nome}</span>
                        <span className="block text-xs text-fatec-muted">RA {a.ra}</span>
                      </td>
                      <td className={`px-2 py-1.5 font-semibold ${cor}`}>
                        <span className="inline-flex items-center gap-1">
                          <Icone className="h-4 w-4 flex-none" />
                          {ROTULO_SITUACAO[a.situacao]}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        {a.trabalhos.length === 0 ? (
                          <span className="text-fatec-muted">—</span>
                        ) : (
                          a.trabalhos.map((tr) => (
                            <span key={tr.titulo} className="block text-fatec-ink">
                              {tituloExibicao(tr.titulo)}{" "}
                              <span className="text-xs text-fatec-muted">
                                ({tr.papel === "Autor principal" ? "enviou" : "coautor"} ·{" "}
                                {ROTULO_STATUS_TRABALHO[tr.status] ?? tr.status})
                              </span>
                            </span>
                          ))
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
