/** Conflito de interesse no envio pra avaliação/desempate (2026-10-27,
 * pedido explícito do usuário — professor pode ser ao mesmo tempo
 * orientador, avaliador e organizador; não pode receber pra avaliar/moderar
 * trabalho de que ele mesmo participa, "ou pelo menos dar o aviso pra quem
 * está disparando").
 *
 * Autor é pelo uid (dono ou colega em participantesUids). Orientador e
 * coorientador são texto livre no trabalho, então a comparação é pelo NOME:
 *  - "certo": todas as palavras significativas do nome mais curto aparecem
 *    no mais longo e o primeiro nome é igual ("Talitta Rafaela" ×
 *    "Talitta Rafaela da Silva Boca"), com pelo menos 2 palavras;
 *  - "possivel": só o primeiro nome bate (ex.: orientador escrito só
 *    "Joana") — aviso de que PODE ser a mesma pessoa. */

export type NivelConflito = "certo" | "possivel";
export type Conflito = { papel: "autor(a)" | "orientador(a)" | "coorientador(a)"; nivel: NivelConflito };

type Pessoa = { uid: string; nome: string };
type TrabalhoParaConflito = {
  alunoUid: string;
  participantesUids?: string[];
  nomeOrientador?: string;
  nomesCoorientadores?: string[];
};

const LIGACOES = new Set(["da", "de", "do", "das", "dos", "e"]);

function palavras(nome: string): string[] {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p && !LIGACOES.has(p));
}

export function compararNomes(a: string, b: string): NivelConflito | null {
  const pa = palavras(a);
  const pb = palavras(b);
  if (pa.length === 0 || pb.length === 0 || pa[0] !== pb[0]) return null;
  const [curto, longo] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  if (curto.length >= 2 && curto.every((p) => longo.includes(p))) return "certo";
  return curto.length === 1 ? "possivel" : null;
}

export function conflitoDeInteresse(pessoa: Pessoa, trabalho: TrabalhoParaConflito): Conflito | null {
  if (pessoa.uid === trabalho.alunoUid || (trabalho.participantesUids ?? []).includes(pessoa.uid)) {
    return { papel: "autor(a)", nivel: "certo" };
  }
  const achados: Conflito[] = [];
  if (trabalho.nomeOrientador) {
    const nivel = compararNomes(pessoa.nome, trabalho.nomeOrientador);
    if (nivel) achados.push({ papel: "orientador(a)", nivel });
  }
  for (const co of trabalho.nomesCoorientadores ?? []) {
    const nivel = compararNomes(pessoa.nome, co);
    if (nivel) achados.push({ papel: "coorientador(a)", nivel });
  }
  // "certo" tem prioridade sobre "possivel".
  return achados.find((c) => c.nivel === "certo") ?? achados[0] ?? null;
}

/** Divide os trabalhos entre as pessoas respeitando a quantidade de cada uma.
 * Conflito "certo" (autor, ou nome de orientador/coorientador batendo por
 * completo) é TRAVA DE VERDADE (2026-10-28, pedido explícito do usuário) —
 * essa pessoa nunca recebe esse trabalho pra avaliar/moderar, nem que seja a
 * única com vaga sobrando; o trabalho fica sem ninguém nesse caso (devolvido
 * em `naoAtribuidos`), até alguém resolver manualmente. Conflito "possivel"
 * (só o primeiro nome bateu, nome incompleto no trabalho) continua só como
 * aviso — não impede, porque é só um palpite, não confirmação: travar nisso
 * arriscaria bloquear gente errada por coincidência de nome. */
export function planejarDistribuicao<T extends TrabalhoParaConflito & { id: string }>(
  trabalhos: T[],
  cotas: (Pessoa & { quantidade: number })[],
): {
  atribuicoes: { trabalho: T; pessoa: Pessoa }[];
  conflitos: { trabalho: T; pessoa: Pessoa; conflito: Conflito }[];
  naoAtribuidos: { trabalho: T; conflito: Conflito }[];
} {
  const vagas = cotas.map((c) => ({ ...c, resta: c.quantidade }));
  // Trabalhos com mais gente travada primeiro — são os que têm menos opção.
  const nTravados = (t: T) =>
    vagas.filter((v) => conflitoDeInteresse(v, t)?.nivel === "certo").length;
  const ordem = [...trabalhos].sort((a, b) => nTravados(b) - nTravados(a));
  const atribuicoes: { trabalho: T; pessoa: Pessoa }[] = [];
  const conflitos: { trabalho: T; pessoa: Pessoa; conflito: Conflito }[] = [];
  const naoAtribuidos: { trabalho: T; conflito: Conflito }[] = [];
  for (const t of ordem) {
    const livres = vagas.filter((v) => v.resta > 0);
    // Trava: tira de vez quem tem conflito "certo" com esse trabalho.
    const semTrava = livres.filter((v) => conflitoDeInteresse(v, t)?.nivel !== "certo");
    if (semTrava.length === 0) {
      if (livres.length > 0) {
        // Só sobrava gente travada — não atribui ninguém, avisa o porquê.
        naoAtribuidos.push({ trabalho: t, conflito: conflitoDeInteresse(livres[0], t)! });
      }
      continue;
    }
    // Entre quem não está travado, prefere quem também não tem conflito
    // "possivel" (nome incompleto); só cai nisso se não sobrar outra opção.
    const semConflitoNenhum = semTrava.filter((v) => !conflitoDeInteresse(v, t));
    const candidatos = semConflitoNenhum.length ? semConflitoNenhum : semTrava;
    // Entre as opções, prefere quem tem mais vaga sobrando (mantém a divisão equilibrada).
    const escolha = candidatos.sort((a, b) => b.resta - a.resta)[0];
    escolha.resta--;
    const pessoa = { uid: escolha.uid, nome: escolha.nome };
    atribuicoes.push({ trabalho: t, pessoa });
    const c = conflitoDeInteresse(pessoa, t);
    if (c) conflitos.push({ trabalho: t, pessoa, conflito: c });
  }
  return { atribuicoes, conflitos, naoAtribuidos };
}
