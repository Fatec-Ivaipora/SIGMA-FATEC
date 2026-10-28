/** Relatório de participantes por curso (2026-10-28, pedido explícito do
 * usuário — "relatório dos participantes por curso pra entregar aos
 * coordenadores", "da turma de Agronomia, juntando os grupos e se o
 * trabalho foi enviado", "ver ao vivo e gerar em PDF"). Regra única usada
 * pela tela (Relatórios → Participantes por curso, ao vivo) e pelo PDF
 * (/api/relatorios/participantes-curso), pra os dois sempre baterem.
 *
 * Curso de cada pessoa vem de usuarios/{uid}.curso (quem é de fora não tem).
 * "Grupo" = um trabalho enviado no evento; ele aparece no curso de QUALQUER
 * autor dele (trabalho misto aparece nos dois cursos). Aluno "com trabalho" =
 * dono ou coautor (aceito ou convite pendente) de algum trabalho do evento. */

export const ROTULO_STATUS_TRABALHO: Record<string, string> = {
  // "Em submissão" parecia "ainda não enviou" (2026-10-28, pedido do usuário —
  // "deixar claro o trabalho que tem enviado"). Neste status ele JÁ foi enviado.
  submissao: "Enviado",
  aguardando_avaliacao: "Aguardando avaliação",
  revisao: "Revisão solicitada",
  avaliado: "Avaliado",
  aguardando_apresentacao: "Aguardando apresentação",
  apresentado: "Apresentado",
  aceito: "Aceito",
  nao_aceito: "Recusado",
};

export const ROTULO_INSCRICAO: Record<string, string> = {
  pago: "Paga",
  pendente: "Pagamento pendente",
  // Só clicou em Inscreva-se e não gerou cobrança — pro relatório é a mesma
  // coisa que pendente (2026-10-28, pedido do usuário: "se não pagou é
  // pagamento pendente").
  interesse: "Pagamento pendente",
};

export const SEM_CURSO = "Sem curso informado";

export type InscricaoParaRelatorio = { uid: string; nome: string; email?: string; status: string };
export type TrabalhoParaRelatorio = {
  id: string;
  titulo: string;
  alunoUid: string;
  alunoNome: string;
  participantesUids?: string[];
  participantesNomes?: string[];
  convitesPendentes?: string[];
  nomeOrientador?: string;
  nomesCoorientadores?: string[];
  status: string;
  areaTematica?: string;
};

export type MembroGrupo = { uid: string; nome: string; curso: string; principal: boolean; convitePendente: boolean };
export type GrupoCurso = {
  id: string;
  titulo: string;
  status: string;
  areaTematica?: string;
  orientador?: string;
  coorientadores: string[];
  membros: MembroGrupo[];
};
export type AlunoCurso = {
  uid: string;
  nome: string;
  email?: string;
  inscricao: string;
  trabalhos: { titulo: string; papel: "Autor principal" | "Coautor"; status: string }[];
};
export type RelatorioCurso = {
  curso: string;
  alunos: AlunoCurso[];
  grupos: GrupoCurso[];
  resumo: { inscritos: number; pagos: number; comTrabalho: number; semTrabalho: number; trabalhos: number };
};

export function montarRelatorioCursos(
  inscricoes: InscricaoParaRelatorio[],
  cursoPorUid: Record<string, string | undefined>,
  trabalhos: TrabalhoParaRelatorio[],
): RelatorioCurso[] {
  const cursoDe = (uid: string) => cursoPorUid[uid]?.trim() || SEM_CURSO;
  const nomeInscrito = new Map(inscricoes.map((i) => [i.uid, i.nome]));

  const grupos: GrupoCurso[] = trabalhos.map((t) => {
    const pendentes = new Set(t.convitesPendentes ?? []);
    const membros: MembroGrupo[] = [
      { uid: t.alunoUid, nome: t.alunoNome, curso: cursoDe(t.alunoUid), principal: true, convitePendente: false },
      ...(t.participantesUids ?? []).map((uid, i) => ({
        uid,
        nome: t.participantesNomes?.[i] ?? nomeInscrito.get(uid) ?? uid,
        curso: cursoDe(uid),
        principal: false,
        convitePendente: pendentes.has(uid),
      })),
    ];
    return {
      id: t.id,
      titulo: t.titulo,
      status: t.status,
      areaTematica: t.areaTematica,
      orientador: t.nomeOrientador,
      coorientadores: t.nomesCoorientadores ?? [],
      membros,
    };
  });

  // Trabalhos de cada pessoa (como dono ou coautor).
  const trabalhosPorUid = new Map<string, AlunoCurso["trabalhos"]>();
  for (const g of grupos) {
    for (const m of g.membros) {
      const lista = trabalhosPorUid.get(m.uid) ?? [];
      lista.push({ titulo: g.titulo, papel: m.principal ? "Autor principal" : "Coautor", status: g.status });
      trabalhosPorUid.set(m.uid, lista);
    }
  }

  const cursos = new Map<string, RelatorioCurso>();
  const doCurso = (curso: string) => {
    let r = cursos.get(curso);
    if (!r) {
      r = { curso, alunos: [], grupos: [], resumo: { inscritos: 0, pagos: 0, comTrabalho: 0, semTrabalho: 0, trabalhos: 0 } };
      cursos.set(curso, r);
    }
    return r;
  };

  for (const i of inscricoes) {
    const r = doCurso(cursoDe(i.uid));
    const trabalhosDele = trabalhosPorUid.get(i.uid) ?? [];
    r.alunos.push({ uid: i.uid, nome: i.nome, email: i.email, inscricao: i.status, trabalhos: trabalhosDele });
  }
  for (const g of grupos) {
    for (const curso of new Set(g.membros.map((m) => m.curso))) doCurso(curso).grupos.push(g);
  }

  for (const r of cursos.values()) {
    r.alunos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    r.grupos.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
    r.resumo = {
      inscritos: r.alunos.length,
      pagos: r.alunos.filter((a) => a.inscricao === "pago").length,
      comTrabalho: r.alunos.filter((a) => a.trabalhos.length > 0).length,
      semTrabalho: r.alunos.filter((a) => a.trabalhos.length === 0).length,
      trabalhos: r.grupos.length,
    };
  }

  return [...cursos.values()].sort((a, b) =>
    a.curso === SEM_CURSO ? 1 : b.curso === SEM_CURSO ? -1 : a.curso.localeCompare(b.curso, "pt-BR"),
  );
}
