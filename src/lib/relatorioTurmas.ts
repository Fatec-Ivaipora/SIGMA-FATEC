/** Relatório por TURMA do Edubox (2026-10-28, pedido explícito do usuário —
 * "bater com o relatório do Edubox que tem as turmas e os alunos ativos"):
 * cada aluno com matrícula ativa numa turma dos semestres ativos, marcado
 * como "não se inscreveu", "inscrito sem trabalho" ou "com trabalho" no
 * evento. A ligação aluno do Edubox × conta do SIGMA é pelo CPF, mas só como
 * HMAC (o CPF nunca sai do relay — ver turmas-ativas.mjs no relay e
 * cpfHash na rota /api/relatorios/turmas-edubox). Regra pura, usada pela
 * rota, pelo PDF e pela tela. */

export type AlunoAtivoEdubox = {
  ra: string;
  nome: string;
  cpfHash: string | null;
  turma: number;
  turma_nome: string;
  curso: string;
  curso_nome: string;
  semestre: string;
  periodo: number | null;
};

export type SituacaoNoEvento = "nao_inscrito" | "inscrito_sem_trabalho" | "com_trabalho";

export const ROTULO_SITUACAO: Record<SituacaoNoEvento, string> = {
  nao_inscrito: "Não se inscreveu",
  inscrito_sem_trabalho: "Inscrito, sem trabalho enviado",
  com_trabalho: "Trabalho enviado",
};

export type AlunoTurma = {
  ra: string;
  nome: string;
  situacao: SituacaoNoEvento;
  inscricao?: string;
  trabalhos: { titulo: string; papel: "Autor principal" | "Coautor"; status: string }[];
};
export type TurmaRelatorio = {
  turma: number;
  nome: string;
  periodo: number | null;
  semestre: string;
  alunos: AlunoTurma[];
  resumo: { ativos: number; inscritos: number; comTrabalho: number; naoInscritos: number };
};
export type CursoTurmas = {
  curso: string;
  turmas: TurmaRelatorio[];
  resumo: { ativos: number; inscritos: number; comTrabalho: number; naoInscritos: number };
};

export function montarRelatorioTurmas(
  alunosAtivos: AlunoAtivoEdubox[],
  // por hash de CPF: inscrição no evento (status) e trabalhos de que participa
  sigmaPorHash: Map<string, { inscricao?: string; trabalhos: AlunoTurma["trabalhos"] }>,
): CursoTurmas[] {
  const cursos = new Map<string, Map<number, TurmaRelatorio>>();
  for (const a of alunosAtivos) {
    const doSigma = a.cpfHash ? sigmaPorHash.get(a.cpfHash) : undefined;
    const trabalhos = doSigma?.trabalhos ?? [];
    const situacao: SituacaoNoEvento =
      trabalhos.length > 0 ? "com_trabalho" : doSigma?.inscricao ? "inscrito_sem_trabalho" : "nao_inscrito";
    const nomeCurso = a.curso_nome || a.curso;
    let turmas = cursos.get(nomeCurso);
    if (!turmas) cursos.set(nomeCurso, (turmas = new Map()));
    let t = turmas.get(a.turma);
    if (!t) {
      t = { turma: a.turma, nome: a.turma_nome, periodo: a.periodo, semestre: a.semestre, alunos: [], resumo: { ativos: 0, inscritos: 0, comTrabalho: 0, naoInscritos: 0 } };
      turmas.set(a.turma, t);
    }
    if (t.alunos.some((x) => x.ra === a.ra)) continue;
    t.alunos.push({ ra: a.ra, nome: a.nome, situacao, inscricao: doSigma?.inscricao, trabalhos });
  }

  const resumoDe = (alunos: AlunoTurma[]) => ({
    ativos: alunos.length,
    inscritos: alunos.filter((x) => x.situacao !== "nao_inscrito").length,
    comTrabalho: alunos.filter((x) => x.situacao === "com_trabalho").length,
    naoInscritos: alunos.filter((x) => x.situacao === "nao_inscrito").length,
  });

  return [...cursos.entries()]
    .map(([curso, turmasMap]) => {
      const turmas = [...turmasMap.values()]
        .map((t) => {
          t.alunos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
          return { ...t, resumo: resumoDe(t.alunos) };
        })
        .sort((a, b) => (a.periodo ?? 0) - (b.periodo ?? 0) || a.nome.localeCompare(b.nome, "pt-BR"));
      // Aluno em mais de uma turma do curso (ex.: DP) conta uma vez só no resumo do curso.
      const unicos = new Map<string, AlunoTurma>();
      for (const t of turmas) for (const a of t.alunos) unicos.set(a.ra, a);
      return { curso, turmas, resumo: resumoDe([...unicos.values()]) };
    })
    .sort((a, b) => a.curso.localeCompare(b.curso, "pt-BR"));
}
