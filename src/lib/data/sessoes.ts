"use client";

import { useEffect, useState } from "react";
import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/** sessoes/{id} (2026-09-17) — um bloco de horário numa sala, pra uma
 * área+modalidade, com os trabalhos designados naquele bloco (em ordem de
 * apresentação). Gerado pela grade automática de /ensalamento — ver
 * montarGradeAutomatica/substituirGradeDoEvento abaixo. O horário individual
 * de cada trabalho dentro do bloco é calculado na tela
 * (horarioInicio + índice * duração), não é gravado por trabalho. */
export type Sessao = {
  id: string;
  eventoId: string;
  salaId: string;
  areaTematica: string;
  modalidade: "oral" | "roda_conversa";
  horarioInicio: Timestamp;
  horarioFim: Timestamp;
  trabalhoIds: string[];
};

export function useSessoesDoEvento(eventoId: string | undefined) {
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!eventoId) {
      Promise.resolve().then(() => {
        setSessoes([]);
        setCarregando(false);
      });
      return;
    }
    const q = query(collection(db, "sessoes"), where("eventoId", "==", eventoId));
    return onSnapshot(q, (snap) => {
      setSessoes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Sessao));
      setCarregando(false);
    });
  }, [eventoId]);

  return { sessoes, carregando };
}

export type GrupoParaGrade = {
  areaTematica: string;
  modalidade: "oral" | "roda_conversa";
  trabalhoIds: string[];
};

export type SalaParaGrade = { id: string };

export type SessaoGerada = {
  salaId: string;
  areaTematica: string;
  modalidade: "oral" | "roda_conversa";
  horarioInicio: Date;
  horarioFim: Date;
  trabalhoIds: string[];
};

// Algoritmo determinístico "first-fit decreasing" (bin-packing, 2026-09-17)
// — nada de IA/LLM, confirmado com o usuário. Cada sala é um "bin" com
// capacidade em minutos; cada grupo (área x modalidade) é distribuído,
// maior primeiro. Trabalhos que não couberem em nenhuma sala (capacidade
// total insuficiente) voltam em overflowTrabalhoIds pra virar aviso na
// tela, sem travar o resto da geração.
//
// Estratégia "best-fit" (2026-11-04, corrigido — achado real do usuário:
// "tem sala com 1 apresentação, outra com 3, 2, 5... se 7 é o limite,
// coloque todos com 7"). Antes era "worst-fit" (sempre pulava pra sala com
// MAIS espaço livre) — isso espalhava sobra por várias salas em vez de
// terminar de encher uma antes de abrir outra: ex. sala A fica com 1 vaga
// sobrando, mas o próximo grupo prefere uma sala totalmente livre (mais
// espaço) em vez de completar essa vaga, e a sala A nunca mais é
// revisitada enquanto sobrar sala livre — resultado: dezenas de salas
// meio-vazias (1, 2, 3, 5 trabalhos) e sobra artificial de trabalho sem
// sala (ex.: 33 na X MAC), mesmo com capacidade de sobra no total. Agora é
// o oposto — sempre a sala com MENOS espaço livre que ainda caiba pelo
// menos 1 apresentação — isso prioriza terminar de encher salas já em uso
// antes de abrir uma nova, consolidando a sobra junto em vez de espalhada.
//
// Roda de conversa (banner/pôster, 2026-09-28) tem um jeito de ocupar sala
// bem diferente de apresentação oral — confirmado pesquisando o formato
// padrão desses eventos: todos os banners de uma sala ficam expostos ao
// MESMO TEMPO, o bloco inteiro (não fatiado por minuto, um trabalho de cada
// vez como na oral), e o apresentador fica parado do lado o tempo todo. Por
// isso a sala vira uma "vaga simultânea" (capacidade = quantos banners
// cabem, não quantos minutos sobram) — não dá pra dividir a mesma sala/
// horário com uma sessão oral, mas ÁREAS DIFERENTES de roda de conversa
// PODEM dividir a mesma sala (2026-11-04, corrigido — achado real: 5 áreas
// de banner pequenas pegavam 5 salas inteiras cada, a maioria quase vazia,
// "eles podem ficar todos na mesma sala" — sala de banner agora só fica de
// fora do best-fit da ORAL, mas continua recebendo banner de outra área
// até lotar vagasBannerPorSala).
export function montarGradeAutomatica(params: {
  grupos: GrupoParaGrade[];
  salas: SalaParaGrade[];
  apresentacaoInicio: Date;
  apresentacaoFim: Date;
  duracaoApresentacaoMinutos: number;
  vagasBannerPorSala: number;
}): { sessoesNovas: SessaoGerada[]; overflowTrabalhoIds: string[] } {
  const capacidadeTotalMin = Math.floor(
    (params.apresentacaoFim.getTime() - params.apresentacaoInicio.getTime()) / 60000,
  );
  const duracao = params.duracaoApresentacaoMinutos;
  const vagasBanner = Math.max(0, Math.floor(params.vagasBannerPorSala));
  const cursoresOral = new Map(params.salas.map((s) => [s.id, 0]));
  const cursoresBanner = new Map(params.salas.map((s) => [s.id, 0]));
  // Modalidade que "tomou" cada sala, pra nunca misturar oral com banner na
  // mesma sala — a primeira modalidade a usar a sala reserva ela.
  const modalidadeDaSala = new Map<string, "oral" | "roda_conversa">();
  const sessoesNovas: SessaoGerada[] = [];
  const overflowTrabalhoIds: string[] = [];

  // Roda de conversa inteira primeiro, depois oral (2026-11-04, corrigido
  // — achado real validando com os 299 trabalhos da X MAC: ordenar só por
  // tamanho, misturando as duas modalidades, deixava os grupos GRANDES de
  // oral (91, 48, 37...) consumirem toda sala disponível antes de qualquer
  // grupo de roda de conversa ter vez — mesmo pequenos (6, 5, 1, 1, 1), a
  // soma dos maiores de oral sozinha já estourava a capacidade total, e
  // banner ficava 100% de fora. Maior primeiro DENTRO de cada modalidade
  // continua igual.
  const gruposOrdenados = [...params.grupos].sort((a, b) => {
    if (a.modalidade !== b.modalidade) return a.modalidade === "roda_conversa" ? -1 : 1;
    return b.trabalhoIds.length - a.trabalhoIds.length;
  });

  for (const grupo of gruposOrdenados) {
    let pendentes = [...grupo.trabalhoIds];

    if (grupo.modalidade === "roda_conversa") {
      while (pendentes.length > 0) {
        if (vagasBanner <= 0) {
          overflowTrabalhoIds.push(...pendentes);
          break;
        }
        // Best-fit: sala de banner (ou ainda sem modalidade) com MENOS
        // vaga livre que ainda caiba pelo menos 1 — prioriza terminar de
        // encher uma sala já com banner de outra área antes de abrir uma
        // livre nova.
        let melhorSalaId: string | null = null;
        let melhorLivre = Infinity;
        for (const sala of params.salas) {
          if (modalidadeDaSala.get(sala.id) === "oral") continue;
          const livre = vagasBanner - (cursoresBanner.get(sala.id) ?? 0);
          if (livre > 0 && livre < melhorLivre) {
            melhorLivre = livre;
            melhorSalaId = sala.id;
          }
        }
        if (!melhorSalaId) {
          overflowTrabalhoIds.push(...pendentes);
          break;
        }
        const quantidade = Math.min(melhorLivre, pendentes.length);
        const fatia = pendentes.slice(0, quantidade);
        pendentes = pendentes.slice(quantidade);
        sessoesNovas.push({
          salaId: melhorSalaId,
          areaTematica: grupo.areaTematica,
          modalidade: grupo.modalidade,
          horarioInicio: params.apresentacaoInicio,
          horarioFim: params.apresentacaoFim,
          trabalhoIds: fatia,
        });
        cursoresBanner.set(melhorSalaId, (cursoresBanner.get(melhorSalaId) ?? 0) + quantidade);
        modalidadeDaSala.set(melhorSalaId, "roda_conversa");
      }
      continue;
    }

    while (pendentes.length > 0) {
      // Best-fit: sala com MENOS espaço livre que ainda caiba pelo menos 1
      // apresentação inteira — prioriza terminar de encher uma sala já em
      // uso (de oral) antes de abrir uma nova, em vez de espalhar sobra.
      let melhorSalaId: string | null = null;
      let melhorLivre = Infinity;
      for (const sala of params.salas) {
        if (modalidadeDaSala.get(sala.id) === "roda_conversa") continue;
        const livre = capacidadeTotalMin - (cursoresOral.get(sala.id) ?? 0);
        if (livre >= duracao && livre < melhorLivre) {
          melhorLivre = livre;
          melhorSalaId = sala.id;
        }
      }
      if (!melhorSalaId) {
        overflowTrabalhoIds.push(...pendentes);
        break;
      }
      const cursorAtual = cursoresOral.get(melhorSalaId) ?? 0;
      const quantidade = Math.min(Math.floor(melhorLivre / duracao), pendentes.length);
      const fatia = pendentes.slice(0, quantidade);
      pendentes = pendentes.slice(quantidade);
      const horarioInicio = new Date(params.apresentacaoInicio.getTime() + cursorAtual * 60000);
      const horarioFim = new Date(horarioInicio.getTime() + quantidade * duracao * 60000);
      sessoesNovas.push({
        salaId: melhorSalaId,
        areaTematica: grupo.areaTematica,
        modalidade: grupo.modalidade,
        horarioInicio,
        horarioFim,
        trabalhoIds: fatia,
      });
      cursoresOral.set(melhorSalaId, cursorAtual + quantidade * duracao);
      modalidadeDaSala.set(melhorSalaId, "oral");
    }
  }

  return { sessoesNovas, overflowTrabalhoIds };
}

// Limite do Firestore é 500 operações por writeBatch — folga pra não
// encostar nele.
const OPERACOES_POR_LOTE = 450;

type Operacao = (batch: ReturnType<typeof writeBatch>) => void;

async function gravarEmLotes(operacoes: Operacao[]) {
  for (let i = 0; i < operacoes.length; i += OPERACOES_POR_LOTE) {
    const batch = writeBatch(db);
    for (const op of operacoes.slice(i, i + OPERACOES_POR_LOTE)) op(batch);
    await batch.commit();
  }
}

// Substitui a grade inteira do evento: grava as sessões novas + o sessaoId
// de cada trabalho alocado, limpa sessaoId de quem ficou de fora e só então
// apaga as sessões antigas. Dividido em lotes (2026-09-24) — num lote só
// passava do limite de 500 operações a partir de ~245 trabalhos, e o
// PRODUCT.md prevê até 500 por evento. Sem atomicidade entre lotes, a ordem
// é o que garante a recuperação: se cair no meio, "Gerar grade" de novo
// recebe as sessões meio-criadas em sessoesAntigas e limpa tudo.
export async function substituirGradeDoEvento(params: {
  eventoId: string;
  sessoesAntigas: { id: string }[];
  trabalhosDoEvento: { id: string }[];
  sessoesNovas: SessaoGerada[];
}) {
  const operacoes: Operacao[] = [];
  const alocados = new Set<string>();

  for (const nova of params.sessoesNovas) {
    const ref = doc(collection(db, "sessoes"));
    operacoes.push((b) =>
      b.set(ref, {
        eventoId: params.eventoId,
        salaId: nova.salaId,
        areaTematica: nova.areaTematica,
        modalidade: nova.modalidade,
        horarioInicio: Timestamp.fromDate(nova.horarioInicio),
        horarioFim: Timestamp.fromDate(nova.horarioFim),
        trabalhoIds: nova.trabalhoIds,
        criadoEm: serverTimestamp(),
      }),
    );
    for (const trabalhoId of nova.trabalhoIds) {
      alocados.add(trabalhoId);
      operacoes.push((b) =>
        b.update(doc(db, "trabalhos", trabalhoId), {
          sessaoId: ref.id,
          atualizadoEm: serverTimestamp(),
        }),
      );
    }
  }
  for (const t of params.trabalhosDoEvento) {
    if (alocados.has(t.id)) continue;
    operacoes.push((b) => b.update(doc(db, "trabalhos", t.id), { sessaoId: deleteField() }));
  }
  for (const s of params.sessoesAntigas) {
    operacoes.push((b) => b.delete(doc(db, "sessoes", s.id)));
  }

  await gravarEmLotes(operacoes);
}

type SessaoLayout = {
  id: string;
  salaId: string;
  modalidade: "oral" | "roda_conversa";
  horarioInicio: Date;
  horarioFim: Date;
  trabalhoIds: string[];
};

// Reorganiza as sessões de uma sala uma colada na outra, a partir do
// horário da primeira, com duração = trabalhos × duração de cada um.
// Sessão sem trabalho nenhum some da sala. Não se aplica a roda de conversa
// (ver montarGradeAutomatica) — uma sala de banner nunca mistura com sessão
// oral, então "a sala inteira é de banner" ou "a sala inteira é fatiada por
// minuto", nunca as duas ao mesmo tempo.
function realinharSala(
  sessoesDaSala: SessaoLayout[],
  duracaoMin: number,
  apresentacaoInicio: Date,
  apresentacaoFim: Date,
): SessaoLayout[] {
  if (sessoesDaSala.some((s) => s.modalidade === "roda_conversa")) {
    return sessoesDaSala
      .filter((s) => s.trabalhoIds.length > 0)
      .map((s) => ({ ...s, horarioInicio: apresentacaoInicio, horarioFim: apresentacaoFim }));
  }
  const ordenadas = [...sessoesDaSala].sort(
    (a, b) => a.horarioInicio.getTime() - b.horarioInicio.getTime(),
  );
  if (ordenadas.length === 0) return [];
  let cursor = ordenadas[0].horarioInicio.getTime();
  const resultado: SessaoLayout[] = [];
  for (const s of ordenadas) {
    if (s.trabalhoIds.length === 0) continue;
    const inicio = new Date(cursor);
    cursor += s.trabalhoIds.length * duracaoMin * 60000;
    resultado.push({ ...s, horarioInicio: inicio, horarioFim: new Date(cursor) });
  }
  return resultado;
}

// Ajuste manual pós-geração (2026-09-17, pedido do usuário) — move um
// trabalho de uma sessão pra outra do mesmo evento sem precisar regenerar a
// grade inteira. Desde 2026-09-24 recalcula os horários das salas de origem
// e destino (antes só trocava o trabalho de lista, e o movido ficava depois
// do fim da sessão, podendo cair em cima da próxima sessão da mesma sala).
// Recusa se a sala de destino passar do fim das apresentações.
export async function moverTrabalho(params: {
  trabalhoId: string;
  deSessaoId: string;
  paraSessaoId: string;
  sessoes: Sessao[];
  duracaoApresentacaoMinutos: number;
  vagasBannerPorSala: number;
  apresentacaoInicio: Date;
  apresentacaoFim: Date;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  const layout: SessaoLayout[] = params.sessoes.map((s) => ({
    id: s.id,
    salaId: s.salaId,
    modalidade: s.modalidade,
    horarioInicio: s.horarioInicio.toDate(),
    horarioFim: s.horarioFim.toDate(),
    trabalhoIds:
      s.id === params.deSessaoId
        ? s.trabalhoIds.filter((id) => id !== params.trabalhoId)
        : s.id === params.paraSessaoId
          ? [...s.trabalhoIds.filter((id) => id !== params.trabalhoId), params.trabalhoId]
          : s.trabalhoIds,
  }));
  const origem = layout.find((s) => s.id === params.deSessaoId);
  const destino = layout.find((s) => s.id === params.paraSessaoId);
  if (!origem || !destino) return { ok: false, erro: "Sessão não encontrada." };
  // Roda de conversa e oral ocupam a sala de jeitos incompatíveis (bloco
  // inteiro × fatiado por minuto) — mover entre modalidades diferentes
  // corromperia o horário de um dos dois lados.
  if (origem.modalidade !== destino.modalidade) {
    return { ok: false, erro: "Não dá pra mover entre uma sessão oral e uma de roda de conversa." };
  }
  if (destino.modalidade === "roda_conversa" && destino.trabalhoIds.length > params.vagasBannerPorSala) {
    return {
      ok: false,
      erro: `Não cabe: essa sala de roda de conversa já tem ${params.vagasBannerPorSala} vaga(s) ocupada(s), o máximo configurado.`,
    };
  }

  const salasAfetadas = new Set([origem.salaId, destino.salaId]);
  const antesPorId = new Map(layout.map((s) => [s.id, s]));
  const batch = writeBatch(db);

  for (const salaId of salasAfetadas) {
    const daSala = layout.filter((s) => s.salaId === salaId);
    const realinhadas = realinharSala(
      daSala,
      params.duracaoApresentacaoMinutos,
      params.apresentacaoInicio,
      params.apresentacaoFim,
    );
    const ultima = realinhadas[realinhadas.length - 1];
    if (ultima && ultima.horarioFim.getTime() > params.apresentacaoFim.getTime()) {
      return {
        ok: false,
        erro: "Não cabe: essa sala passaria do horário de fim das apresentações.",
      };
    }
    const mantidas = new Set(realinhadas.map((s) => s.id));
    for (const s of daSala) {
      if (!mantidas.has(s.id)) batch.delete(doc(db, "sessoes", s.id));
    }
    for (const s of realinhadas) {
      const antes = antesPorId.get(s.id);
      const mudouLista = s.id === params.deSessaoId || s.id === params.paraSessaoId;
      const mudouHorario =
        !antes ||
        antes.horarioInicio.getTime() !== s.horarioInicio.getTime() ||
        antes.horarioFim.getTime() !== s.horarioFim.getTime();
      if (!mudouLista && !mudouHorario) continue;
      batch.update(doc(db, "sessoes", s.id), {
        horarioInicio: Timestamp.fromDate(s.horarioInicio),
        horarioFim: Timestamp.fromDate(s.horarioFim),
        ...(mudouLista ? { trabalhoIds: s.trabalhoIds } : {}),
      });
    }
  }

  batch.update(doc(db, "trabalhos", params.trabalhoId), {
    sessaoId: params.paraSessaoId,
    atualizadoEm: serverTimestamp(),
  });
  await batch.commit();
  return { ok: true };
}
