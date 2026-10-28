"use client";

import { Fragment, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Download, Loader2 } from "lucide-react";
import type { User } from "firebase/auth";
import { baixarRelatorioCursos } from "@/lib/baixarCertificado";
import {
  montarRelatorioCursos,
  ROTULO_INSCRICAO,
  ROTULO_STATUS_TRABALHO,
  type InscricaoParaRelatorio,
  type RelatorioCurso,
  type TrabalhoParaRelatorio,
} from "@/lib/relatorioCursos";
import { tituloExibicao } from "@/lib/tituloTrabalho";

/** Aba "Participantes por curso" do relatório do evento (2026-10-28, pedido
 * explícito do usuário — "ver ao vivo e gerar o relatório em PDF" pra
 * entregar aos coordenadores; "juntar os grupos e se o trabalho foi
 * enviado"). Recebe inscrições e trabalhos já ao vivo (onSnapshot) da página
 * de Relatórios — os números mudam sozinhos. Tudo dá pra ver na tela ("Ver"
 * abre o curso logo abaixo da linha); o PDF é só pra entregar. PDF: um curso
 * ou todos (/api/relatorios/participantes-curso), mesma regra
 * (montarRelatorioCursos). */
export function RelatorioParticipantesCurso({
  user,
  eventoId,
  inscricoes,
  cursoPorUid,
  trabalhos,
}: {
  user: User | null | undefined;
  eventoId: string;
  inscricoes: InscricaoParaRelatorio[];
  cursoPorUid: Record<string, string>;
  trabalhos: TrabalhoParaRelatorio[];
}) {
  const cursos = useMemo(
    () => montarRelatorioCursos(inscricoes, cursoPorUid, trabalhos),
    [inscricoes, cursoPorUid, trabalhos],
  );
  const [aberto, setAberto] = useState<string | null>(null);
  const [gerando, setGerando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function gerarPdf(curso?: string) {
    if (!user) return;
    setErro(null);
    setGerando(curso ?? "__todos__");
    const r = await baixarRelatorioCursos(user, { eventoId, curso });
    if (!r.ok) setErro(r.erro);
    setGerando(null);
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-fatec-line bg-white p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-fatec-navy-900">Participantes por curso</h2>
          <p className="text-sm text-fatec-muted">
            Atualiza ao vivo. Clique em <strong>Ver</strong> para abrir os grupos e os alunos do curso aqui
            na tela; o PDF é para entregar ao coordenador.
          </p>
        </div>
        <button
          type="button"
          onClick={() => gerarPdf()}
          disabled={gerando !== null || cursos.length === 0}
          className="flex flex-none items-center gap-1.5 rounded-xl border border-fatec-line px-4 py-2 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted"
        >
          {gerando === "__todos__" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          PDF de todos os cursos
        </button>
      </div>

      {erro && <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{erro}</p>}

      {cursos.length === 0 ? (
        <p className="text-sm text-fatec-muted">Nenhum inscrito neste evento ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fatec-line text-left text-xs uppercase tracking-wide text-fatec-muted">
                <th className="py-2 pr-3 font-semibold">Curso</th>
                <th className="px-2 py-2 text-right font-semibold">Inscritos</th>
                <th className="px-2 py-2 text-right font-semibold">Pagos</th>
                <th className="px-2 py-2 text-right font-semibold">Enviaram trabalho</th>
                <th className="px-2 py-2 text-right font-semibold">Sem trabalho enviado</th>
                <th className="px-2 py-2 text-right font-semibold">Trabalhos enviados</th>
                <th className="py-2 pl-2" />
              </tr>
            </thead>
            <tbody>
              {cursos.map((c) => {
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
                      <td className="px-2 py-2 text-right tabular-nums">{c.resumo.inscritos}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.resumo.pagos}</td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-emerald-700">
                        {c.resumo.comTrabalho}
                      </td>
                      <td
                        className={`px-2 py-2 text-right tabular-nums ${c.resumo.semTrabalho > 0 ? "font-semibold text-amber-700" : ""}`}
                      >
                        {c.resumo.semTrabalho}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.resumo.trabalhos}</td>
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
                          <DetalheCurso curso={c} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DetalheCurso({ curso }: { curso: RelatorioCurso }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-fatec-navy-900">
        Trabalhos enviados — grupos ({curso.grupos.length})
      </h3>
      {curso.grupos.length === 0 ? (
        <p className="text-sm text-fatec-muted">Nenhum trabalho enviado com aluno deste curso.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {curso.grupos.map((g) => (
            <li key={g.id} className="rounded-xl border border-fatec-line bg-white px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-fatec-navy-900">{tituloExibicao(g.titulo)}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {ROTULO_STATUS_TRABALHO[g.status] ?? g.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-fatec-ink">
                {g.membros
                  .map(
                    (m) =>
                      `${m.nome}${m.principal ? " (enviou)" : ""}${m.convitePendente ? " (convite pendente)" : ""}${
                        m.curso !== curso.curso ? ` — ${m.curso}` : ""
                      }`,
                  )
                  .join(" · ")}
              </p>
              {(g.orientador || g.coorientadores.length > 0) && (
                <p className="mt-0.5 text-xs text-fatec-muted">
                  Orientação: {[g.orientador, ...g.coorientadores.map((c) => `${c} (coorientação)`)].filter(Boolean).join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-sm font-semibold text-fatec-navy-900">
        Alunos inscritos ({curso.alunos.length}) —{" "}
        <span className="text-emerald-700">{curso.resumo.comTrabalho} com trabalho enviado</span> ·{" "}
        <span className="text-amber-700">{curso.resumo.semTrabalho} sem trabalho enviado</span>
      </h3>
      <div className="overflow-x-auto rounded-xl border border-fatec-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fatec-line text-left text-xs uppercase tracking-wide text-fatec-muted">
              <th className="px-3 py-2 font-semibold">Aluno</th>
              <th className="px-2 py-2 font-semibold">Inscrição</th>
              <th className="px-3 py-2 font-semibold">Trabalho</th>
            </tr>
          </thead>
          <tbody>
            {curso.alunos.map((a) => (
              <tr key={a.uid} className="border-b border-fatec-line last:border-0 align-top">
                <td className="px-3 py-2">
                  <span className="font-medium text-fatec-navy-900">{a.nome}</span>
                  {a.email && <span className="block text-xs text-fatec-muted">{a.email}</span>}
                </td>
                <td className="px-2 py-2">{ROTULO_INSCRICAO[a.inscricao] ?? a.inscricao}</td>
                <td className="px-3 py-2">
                  {a.trabalhos.length === 0 ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                      <CircleAlert className="h-4 w-4" />
                      Nenhum trabalho enviado
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Trabalho enviado
                      </span>
                      {a.trabalhos.map((t) => (
                        <span key={t.titulo} className="block text-fatec-ink">
                          {tituloExibicao(t.titulo)}{" "}
                          <span className="text-xs text-fatec-muted">
                            ({t.papel === "Autor principal" ? "enviou" : "coautor"} ·{" "}
                            {ROTULO_STATUS_TRABALHO[t.status] ?? t.status})
                          </span>
                        </span>
                      ))}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
