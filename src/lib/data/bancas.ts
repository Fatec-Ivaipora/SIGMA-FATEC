"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Trabalho } from "@/lib/data/trabalhos";

export type NotaBancaTCC = NonNullable<Trabalho["notasBanca"]>[number];

/** disponibilidadeBanca/{eventoId}_{uid} (2026-11-16, pedido explícito do
 * usuário) — autoatendimento: cada avaliador/orientador/moderador vinculado
 * a um evento de TCC marca em que dias (dentro da janela
 * dataRealizacao..dataRealizacaoFim do evento) pode fazer parte de uma
 * banca, e quantas bancas no máximo nesse dia (capacidade — no histórico
 * real da "VI Mostra de TCC", a maioria marcava "2"). Isso é cruzado por
 * `montarBancaAutomatica` abaixo — bem diferente do ensalamento por sala×
 * horário do Evento MAC (ver src/lib/data/sessoes.ts), aqui não tem sala
 * nenhuma, só dia. */
export type DisponibilidadeBanca = {
  eventoId: string;
  uid: string;
  nome: string;
  // "AAAA-MM-DD" -> capacidade (máx. de bancas nesse dia para essa pessoa).
  dias: Record<string, number>;
};

export function useDisponibilidadeDoEvento(eventoId: string | undefined) {
  const [disponibilidades, setDisponibilidades] = useState<DisponibilidadeBanca[]>([]);
  // Lazy (2026-11-16) — já nasce "não carregando" sem eventoId, em vez de
  // começar true e precisar de um setCarregando(false) síncrono dentro do
  // efeito só pra esse caso (quem chama sem eventoId não está esperando
  // nada carregar de verdade).
  const [carregando, setCarregando] = useState(!!eventoId);

  useEffect(() => {
    if (!eventoId) return;
    const q = query(collection(db, "disponibilidadeBanca"), where("eventoId", "==", eventoId));
    return onSnapshot(q, (snap) => {
      setDisponibilidades(snap.docs.map((d) => d.data() as DisponibilidadeBanca));
      setCarregando(false);
    });
  }, [eventoId]);

  return { disponibilidades, carregando };
}

export function useMinhaDisponibilidade(eventoId: string | undefined, uid: string | undefined) {
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeBanca | null>(null);
  const [carregando, setCarregando] = useState(!!eventoId && !!uid);

  useEffect(() => {
    if (!eventoId || !uid) return;
    return onSnapshot(doc(db, "disponibilidadeBanca", `${eventoId}_${uid}`), (snap) => {
      setDisponibilidade(snap.exists() ? (snap.data() as DisponibilidadeBanca) : null);
      setCarregando(false);
    });
  }, [eventoId, uid]);

  return { disponibilidade, carregando };
}

/** Autoatendimento, sem passar por rota alguma — é a própria pessoa
 * escrevendo o próprio doc (ver regra nova em firestore.rules). */
export function salvarMinhaDisponibilidade(params: {
  eventoId: string;
  uid: string;
  nome: string;
  dias: Record<string, number>;
}) {
  return setDoc(doc(db, "disponibilidadeBanca", `${params.eventoId}_${params.uid}`), {
    eventoId: params.eventoId,
    uid: params.uid,
    nome: params.nome,
    dias: params.dias,
  });
}

// Lista "AAAA-MM-DD" de cada dia entre início e fim, incluindo os dois —
// mesmo espírito de diasDoEvento (src/lib/certificadoDias.ts), mas
// devolvendo as datas em si, não só a contagem (a geração de banca precisa
// testar dia a dia, não só saber quantos são).
export function diasDoIntervalo(inicio: string, fim: string): string[] {
  if (!inicio) return [];
  const dias: string[] = [];
  const cursor = new Date(`${inicio}T00:00:00`);
  const ultimo = new Date(`${fim || inicio}T00:00:00`);
  while (cursor.getTime() <= ultimo.getTime()) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

export type TrabalhoParaBanca = {
  id: string;
  orientadorUid: string;
  nomeOrientador: string;
};

export type BancaGerada = {
  trabalhoId: string;
  data: string;
  avaliadores: { uid: string; nome: string }[];
};

/** Função pura determinística (first-fit, sem IA — mesmo espírito de
 * montarGradeAutomatica em sessoes.ts, só que cruzando DIA×PESSOA em vez de
 * SALA×HORÁRIO). Pra cada trabalho, acha o primeiro dia (na ordem de
 * `dias`) em que: (1) o orientador tem capacidade > 0 (ele SEMPRE entra na
 * banca do próprio orientando, pedido explícito do usuário, confirmado em
 * 100% dos certificados reais de 2025) e (2) existem pelo menos 2 OUTRAS
 * pessoas com capacidade > 0 nesse mesmo dia. Entre os candidatos a
 * avaliador, escolhe os 2 com MENOS capacidade sobrando nesse dia
 * (best-fit, mesmo motivo de sessoes.ts: termina de preencher quem já tem
 * pouca sobra em vez de espalhar). O que não couber em dia nenhum volta em
 * `overflowTrabalhoIds`, pra virar aviso na tela em vez de travar o resto. */
export function montarBancaAutomatica(params: {
  trabalhos: TrabalhoParaBanca[];
  disponibilidades: DisponibilidadeBanca[];
  dias: string[];
}): { bancasNovas: BancaGerada[]; overflowTrabalhoIds: string[] } {
  const capacidade = new Map<string, Map<string, number>>();
  const nomePorUid = new Map<string, string>();
  for (const d of params.disponibilidades) {
    capacidade.set(d.uid, new Map(Object.entries(d.dias)));
    nomePorUid.set(d.uid, d.nome);
  }

  const bancasNovas: BancaGerada[] = [];
  const overflowTrabalhoIds: string[] = [];

  for (const t of params.trabalhos) {
    let achou = false;
    for (const dia of params.dias) {
      const capOrientador = capacidade.get(t.orientadorUid)?.get(dia) ?? 0;
      if (capOrientador <= 0) continue;

      const candidatos = Array.from(capacidade.keys())
        .filter((uid) => uid !== t.orientadorUid)
        .filter((uid) => (capacidade.get(uid)?.get(dia) ?? 0) > 0)
        .sort((a, b) => (capacidade.get(a)!.get(dia) ?? 0) - (capacidade.get(b)!.get(dia) ?? 0));
      if (candidatos.length < 2) continue;

      const escolhidos = candidatos.slice(0, 2);
      capacidade.get(t.orientadorUid)!.set(dia, capOrientador - 1);
      for (const uid of escolhidos) {
        capacidade.get(uid)!.set(dia, (capacidade.get(uid)!.get(dia) ?? 0) - 1);
      }

      bancasNovas.push({
        trabalhoId: t.id,
        data: dia,
        avaliadores: escolhidos.map((uid) => ({ uid, nome: nomePorUid.get(uid) ?? uid })),
      });
      achou = true;
      break;
    }
    if (!achou) overflowTrabalhoIds.push(t.id);
  }

  return { bancasNovas, overflowTrabalhoIds };
}

// Mesmo limite/motivo de OPERACOES_POR_LOTE em sessoes.ts — 500 é o teto do
// Firestore por writeBatch, com folga.
const OPERACOES_POR_LOTE = 450;

/** Grava as bancas geradas, 2 escritas por trabalho (bancaData+
 * bancaAvaliadores+status num update só). Diferente de
 * substituirGradeDoEvento (sessoes.ts): não existe "sessão" pra apagar
 * aqui, cada trabalho já carrega a própria banca direto nos seus campos —
 * só atualiza os trabalhos que entraram em bancasNovas. */
export async function substituirBancaDoEvento(bancas: BancaGerada[]) {
  for (let i = 0; i < bancas.length; i += OPERACOES_POR_LOTE) {
    const batch = writeBatch(db);
    for (const b of bancas.slice(i, i + OPERACOES_POR_LOTE)) {
      batch.update(doc(db, "trabalhos", b.trabalhoId), {
        bancaData: b.data,
        bancaAvaliadores: b.avaliadores,
        bancaAvaliadoresUids: b.avaliadores.map((a) => a.uid),
        status: "tcc_banca_agendada",
        atualizadoEm: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

/** Ajuste manual pós-geração (2026-11-16, mesmo espírito de moverTrabalho em
 * sessoes.ts) — admin troca o dia e/ou os 2 avaliadores de UM trabalho sem
 * precisar gerar a banca inteira de novo. Não valida capacidade (é uma
 * escolha manual, deliberadamente por cima do algoritmo automático). */
export function moverBanca(
  trabalhoId: string,
  data: string,
  avaliadores: { uid: string; nome: string }[],
) {
  return updateDoc(doc(db, "trabalhos", trabalhoId), {
    bancaData: data,
    bancaAvaliadores: avaliadores,
    bancaAvaliadoresUids: avaliadores.map((a) => a.uid),
    status: "tcc_banca_agendada",
    atualizadoEm: serverTimestamp(),
  });
}

/** Lança a nota de UM membro da banca (2026-11-16) — nunca sobrescreve a
 * nota dos outros 2 (substitui só a entrada com o mesmo uid, se reenviar).
 * Calcula notaFinalBanca (média) assim que a 3ª nota chega; antes disso o
 * campo fica ausente. firestore.rules restringe quem chama isso a só mexer
 * em notasBanca/notaFinalBanca/atualizadoEm (ver regra de update em
 * /trabalhos — orientadorUid ou bancaAvaliadoresUids bater com quem está
 * logado). */
export async function salvarNotaBanca(params: {
  trabalhoId: string;
  notasBancaAtuais: NotaBancaTCC[];
  minhaNota: NotaBancaTCC;
}) {
  const notasBanca = [
    ...params.notasBancaAtuais.filter((n) => n.uid !== params.minhaNota.uid),
    params.minhaNota,
  ];
  const notaFinalBanca =
    notasBanca.length === 3
      ? notasBanca.reduce((acc, n) => acc + n.nota, 0) / 3
      : undefined;
  await updateDoc(doc(db, "trabalhos", params.trabalhoId), {
    notasBanca,
    ...(notaFinalBanca != null ? { notaFinalBanca } : {}),
    atualizadoEm: serverTimestamp(),
  });
}
