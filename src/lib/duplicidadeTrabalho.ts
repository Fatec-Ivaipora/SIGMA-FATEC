/** Regra de "é o mesmo trabalho?" da checagem de duplicidade (2026-10-21) —
 * separada da rota /api/trabalhos/checar-duplicado pra poder ser testada
 * sozinha contra os dados reais. Ver o comentário da rota pro histórico.
 *
 * Um trabalho já existente vira candidato quando:
 *  - tem o mesmo título (ignorando maiúscula, acento e espaços), OU
 *  - é o mesmo grupo: quem envia já está nele como autor (aceito ou convite
 *    pendente) OU o dono dele está entre os autores adicionados agora; OU
 *  - é do mesmo dono (quem envia é quem enviou o existente);
 * e o candidato só conta como o MESMO trabalho se o resumo for praticamente
 * o mesmo E o orientador não for outro (decisão do usuário — "se o resumo
 * for diferente não é o mesmo trabalho", "resumo e orientador podem ser
 * diferentes também": o tema se repete no mesmo curso ou em outro). */

// Fração das palavras do resumo menor que também aparecem no outro. 0,8
// pega o mesmo texto com pontuação/maiúscula/uma palavra trocada (caso real
// de 21/10: mesmo resumo, só a pontuação diferente = 100%) sem confundir
// dois resumos diferentes sobre o mesmo tema.
const RESUMO_MESMO_TRABALHO = 0.8;
// Abaixo disso não dá pra comparar resumo (vazio, "." etc.) — aí vale só o
// candidato (título/grupo + orientador).
const RESUMO_MINIMO_COMPARAVEL = 50;

export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function palavras(texto: string): Set<string> {
  return new Set(normalizarTexto(texto).split(" ").filter((p) => p.length >= 3));
}

function mesmoResumo(a: string, b: string): boolean {
  if (a.trim().length < RESUMO_MINIMO_COMPARAVEL || b.trim().length < RESUMO_MINIMO_COMPARAVEL) {
    return true;
  }
  const pa = palavras(a);
  const pb = palavras(b);
  if (pa.size === 0 || pb.size === 0) return true;
  let emComum = 0;
  for (const p of pa) if (pb.has(p)) emComum++;
  return emComum / Math.min(pa.size, pb.size) >= RESUMO_MESMO_TRABALHO;
}

// Compara só o PRIMEIRO nome — o mesmo orientador aparece digitado de
// jeitos diferentes em envios do mesmo grupo (casos reais de 21/10: "Joana"
// x "Joana Carolina Ostrowski Ramos", "Layla Thamires" x "Layla Thamires
// de oliveira"). Campo vazio em qualquer um dos lados não separa.
function mesmoOrientador(a: string, b: string): boolean {
  const primeiroA = normalizarTexto(a).split(" ")[0];
  const primeiroB = normalizarTexto(b).split(" ")[0];
  if (!primeiroA || !primeiroB) return true;
  return primeiroA === primeiroB;
}

export type EnvioNovo = {
  uid: string;
  titulo: string;
  resumo: string;
  nomeOrientador: string;
  participantesUids: string[];
};

export type TrabalhoExistente = {
  alunoUid: string;
  titulo?: string;
  resumo?: string;
  nomeOrientador?: string;
  participantesUids?: string[];
  convitesPendentes?: string[];
};

export function ehMesmoTrabalho(novo: EnvioNovo, t: TrabalhoExistente): boolean {
  const autoresDele = [...(t.participantesUids ?? []), ...(t.convitesPendentes ?? [])];
  const mesmoTitulo = normalizarTexto(t.titulo ?? "") === normalizarTexto(novo.titulo);
  // Basta UM lado (2026-10-28): caso real da X MAC — Carlos enviou sozinho,
  // depois Luiz enviou o mesmo trabalho com o Carlos de coautor e o título
  // com uma letra trocada ("enriquecido" x "enriquecida"). Exigir os dois
  // lados deixava passar. Resumo + orientador continuam decidindo.
  const mesmoGrupo =
    autoresDele.includes(novo.uid) || novo.participantesUids.includes(t.alunoUid);
  // Mesmo dono (2026-10-26) — com "Submeter outro trabalho" o aluno pode
  // mandar vários no evento; sem isso, reenviar o MESMO trabalho só trocando
  // o título passava. Resumo + orientador continuam decidindo: trabalhos de
  // verdade diferentes do mesmo aluno não são bloqueados.
  const mesmoDono = t.alunoUid === novo.uid;
  if (!mesmoTitulo && !mesmoGrupo && !mesmoDono) return false;
  return (
    mesmoResumo(novo.resumo, t.resumo ?? "") &&
    mesmoOrientador(novo.nomeOrientador, t.nomeOrientador ?? "")
  );
}
