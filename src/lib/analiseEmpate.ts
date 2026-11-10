import type { Trabalho, TrabalhoStatus } from "@/lib/data/trabalhos";

// Status que já passaram pela avaliação (têm `notaAvaliador`), mesmo quem
// já saiu de "avaliado" por já ter sido aceito/premiado/reavaliado antes —
// é o pool usado tanto pra calcular o pódio quanto pra decidir quais
// trabalhos entram na análise de empate (ver `analisarEmpatesPorArea`
// abaixo). Compartilhado entre trabalhos/page.tsx e ensalamento/page.tsx.
export const STATUS_JA_AVALIADO: TrabalhoStatus[] = [
  "avaliado",
  "revisao",
  "aguardando_apresentacao",
  "apresentado",
  "aceito",
  "nao_aceito",
];

export type AnaliseArea = {
  premiadosDiretos: string[];
  aceitosDiretos: string[];
  empatados: string[];
  // Posição exata (1/2/3) de cada id em premiadosDiretos — só existe pra
  // quem tem posição SEM ambiguidade nenhuma (ver comentário abaixo, achado
  // real 2026-11-10: a tag "1º Premiado" tava errada pra quem já tinha sido
  // aceito direto numa nota baixa, ENQUANTO dois trabalhos de nota mais
  // alta ainda estavam pendurados em empate — a posição tem que contar
  // esses dois também, mesmo sem status "aceito" ainda).
  posicoes: Record<string, number>;
};

// Extraído de src/app/trabalhos/page.tsx (2026-11-10) pra ser reaproveitado
// também em src/app/ensalamento/page.tsx (tag de "tem empate" na grade,
// antes mesmo de mandar pro moderador) — mesmo cálculo, um lugar só, pra
// nunca mais os dois lados divergirem.
//
// Análise de ranking por área temática (2026-09-11, substitui o "empate"
// ingênuo de antes, que marcava qualquer nota repetida — mesmo empatados
// em 8º lugar, o que não tinha nada a ver com o pódio). Só interessa
// empate DENTRO do top 3 (edital 6.6): quem tira nota única acima do
// corte já é premiado direto; quem tira nota única abaixo já não é, sem
// precisar de apresentação nenhuma; quem tem a MESMA nota de outro
// trabalho que caia no top 3 precisa ir pro moderador desempatar.
//
// CORRIGIDO (bug real, achado em 2026-11-09 — "Engenharias e Ciências
// Agrárias: 1º com 25, 2º com 24, 3º com 24", liberado como "sem
// empate"): a versão anterior só considerava empate quando a nota batida
// na 3ª posição tinha gente demais pra vaga (ex.: 4º lugar também com
// aquela nota, disputando a vaga de fora). Duas notas IGUAIS que já
// cabiam tranquilas nas vagas que sobraram (ex.: 25/24/24 com só 3
// trabalhos na área, ou 25/20/20/15 com 4) eram liberadas direto — mas
// mesmo cabendo as duas, ainda não dá pra saber qual delas é 2º e qual é
// 3º lugar de verdade (tem prêmio/certificado por colocação exata). Isso
// também nunca verificava empate ACIMA do corte (dois 1ºs lugares com a
// mesma nota, por exemplo). Agora agrupa por nota (ordem decrescente) e
// anda vaga por vaga: nota sozinha que cabe = premiado direto; nota
// repetida que ainda tem vaga de pódio em jogo (cabendo todo mundo ou
// não) = todo o grupo vai pra empate, sempre — só nota abaixo de onde o
// pódio já fechou (sem mais vaga nenhuma) vira aceito direto, empatada
// ou não (ali embaixo a ordem exata não importa pra prêmio nenhum).
//
// IMPORTANTE: o pool recebido aqui já deve ser filtrado pelo chamador —
// qualquer trabalho que já tenha `notaAvaliador` numérico (mesmo quem já
// saiu de "avaliado" por já ter sido aceito/premiado antes — ver
// STATUS_JA_AVALIADO em trabalhos/page.tsx). Se filtrasse só por status
// "avaliado", "Aceitar sem empate" tiraria os não-empatados da lista e o
// cálculo seguinte recalcularia o corte só com quem sobrou, esquecendo
// que já tinha gente melhor aceita antes.
export function analisarEmpatesPorArea(
  trabalhosComNota: Trabalho[],
): Map<string, AnaliseArea> {
  const porGrupo = new Map<string, Trabalho[]>();
  for (const t of trabalhosComNota) {
    if (typeof t.notaAvaliador !== "number") continue;
    const chave = `${t.eventoId}::${t.areaTematica}`;
    const lista = porGrupo.get(chave) ?? [];
    lista.push(t);
    porGrupo.set(chave, lista);
  }
  const resultado = new Map<string, AnaliseArea>();
  for (const [chave, lista] of porGrupo) {
    const ordenados = [...lista].sort((a, b) => (b.notaAvaliador ?? 0) - (a.notaAvaliador ?? 0));
    const vagasPodio = Math.min(3, ordenados.length);

    // Agrupa pela nota da AVALIAÇÃO só — esse é o critério principal,
    // nunca ultrapassado pela nota da apresentação (ver comentário logo
    // abaixo). Mantendo a ordem decrescente — cada grupo de nota repetida
    // é tratado inteiro de uma vez.
    const gruposPorNotaAvaliador: Trabalho[][] = [];
    for (const t of ordenados) {
      const ultimo = gruposPorNotaAvaliador[gruposPorNotaAvaliador.length - 1];
      if (ultimo && ultimo[0].notaAvaliador === t.notaAvaliador) {
        ultimo.push(t);
      } else {
        gruposPorNotaAvaliador.push([t]);
      }
    }

    // A nota da apresentação (moderador) só desempata quem está DENTRO do
    // mesmo grupo de nota da avaliação — nunca cruza pra outro grupo de
    // nota diferente (2026-11-10, pedido explícito do usuário — "Projetos
    // Integradores – Engenharias e Ciências Agrárias": 1º com 25 (sem
    // precisar de apresentação) e 3 empatados com 24 brigando por 2ª/3ª
    // vaga; "na teoria não era pra passar [o 1º lugar], o primeiro
    // critério é a nota de avaliação... a nota da apresentação é só pra
    // desempatar"). Só subdivide um grupo quando TODO MUNDO dele já tem
    // `notaModerador` — enquanto falta nota de alguém, o grupo inteiro
    // continua em empate (ninguém decide com informação parcial; evita
    // tratar "ainda não avaliado pelo moderador" como "nota zero").
    const subgrupos: Trabalho[][] = [];
    for (const grupo of gruposPorNotaAvaliador) {
      const precisaDesempatarPorApresentacao =
        grupo.length > 1 && grupo.every((t) => typeof t.notaModerador === "number");
      if (!precisaDesempatarPorApresentacao) {
        subgrupos.push(grupo);
        continue;
      }
      const porApresentacao = [...grupo].sort(
        (a, b) => (b.notaModerador ?? 0) - (a.notaModerador ?? 0),
      );
      for (const t of porApresentacao) {
        const ultimo = subgrupos[subgrupos.length - 1];
        if (
          ultimo &&
          ultimo[0].notaAvaliador === t.notaAvaliador &&
          ultimo[0].notaModerador === t.notaModerador
        ) {
          ultimo.push(t);
        } else {
          subgrupos.push([t]);
        }
      }
    }

    const premiadosDiretos: string[] = [];
    const aceitosDiretos: string[] = [];
    const empatados: string[] = [];
    const posicoes: Record<string, number> = {};
    let preenchidos = 0;
    for (const grupo of subgrupos) {
      if (preenchidos >= vagasPodio) {
        // Pódio já fechou antes desse grupo — abaixo da última vaga,
        // ordem exata não importa pra prêmio nenhum.
        grupo.forEach((t) => aceitosDiretos.push(t.id));
      } else if (grupo.length === 1) {
        premiadosDiretos.push(grupo[0].id);
        posicoes[grupo[0].id] = preenchidos + 1;
      } else {
        // Nota repetida ainda com vaga de pódio em jogo (seja na
        // avaliação, seja de novo na apresentação) — sempre precisa de
        // desempate pra decidir a ordem exata, mesmo que todo mundo do
        // grupo já coubesse nas vagas que sobraram.
        grupo.forEach((t) => empatados.push(t.id));
      }
      preenchidos += grupo.length;
    }

    resultado.set(chave, { premiadosDiretos, aceitosDiretos, empatados, posicoes });
  }
  return resultado;
}
