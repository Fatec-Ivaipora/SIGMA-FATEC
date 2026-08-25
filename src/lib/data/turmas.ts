"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type Turma = {
  id: string;
  nome: string;
  disciplina?: string;
  orientadorUid: string;
  orientadorNome: string;
  // Colega entra em alunosUids/Nomes já no convite (mesmo padrão do convite
  // de colega em trabalhos, ver src/lib/data/trabalhos.ts) — fica em
  // convitesPendentesUids até aceitar; recusar remove dos dois.
  alunosUids?: string[];
  alunosNomes?: string[];
  convitesPendentesUids?: string[];
  convitesPendentesNomes?: string[];
  // Mural do orientador — só ele posta (RF do Projeto Integrador, 2026-08-25).
  // Guardado como array no próprio doc (sem subcoleção): volume esperado é
  // baixo (avisos/lembretes), mesma lógica de simplicidade de MVP do resto
  // do app.
  mensagens?: { texto: string; criadoEm: number }[];
  criadoEm?: unknown;
};

export type TurmaTrabalhoStatus = "aguardando_avaliacao" | "revisao" | "aprovado";

export type TurmaTrabalho = {
  id: string;
  turmaId: string;
  titulo: string;
  resumo?: string;
  alunoUid: string;
  alunoNome: string;
  status: TurmaTrabalhoStatus;
  comentarioOrientador?: string | null;
  criadoEm?: unknown;
  atualizadoEm?: unknown;
};

/** Turmas de um orientador (papel "orientador"). */
export function useTurmasDoOrientador(uid: string | null | undefined) {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "turmas"), where("orientadorUid", "==", uid));
    return onSnapshot(q, (snap) => {
      setTurmas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Turma));
      setCarregando(false);
    });
  }, [uid]);

  return { turmas, carregando };
}

/** Turmas de um aluno (dono do convite, aceito ou ainda pendente). */
export function useTurmasDoAluno(uid: string | null | undefined) {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "turmas"), where("alunosUids", "array-contains", uid));
    return onSnapshot(q, (snap) => {
      setTurmas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Turma));
      setCarregando(false);
    });
  }, [uid]);

  return { turmas, carregando };
}

export function useTurma(turmaId: string | undefined) {
  const [turma, setTurma] = useState<Turma | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!turmaId) return;
    return onSnapshot(doc(db, "turmas", turmaId), (snap) => {
      setTurma(snap.exists() ? ({ id: snap.id, ...snap.data() } as Turma) : null);
      setCarregando(false);
    });
  }, [turmaId]);

  return { turma, carregando };
}

export function criarTurma(dados: {
  nome: string;
  disciplina?: string;
  orientadorUid: string;
  orientadorNome: string;
}) {
  return addDoc(collection(db, "turmas"), {
    ...dados,
    alunosUids: [],
    alunosNomes: [],
    convitesPendentesUids: [],
    convitesPendentesNomes: [],
    mensagens: [],
    criadoEm: serverTimestamp(),
  });
}

export function convidarAlunoTurma(turma: Turma, aluno: { uid: string; nome: string }) {
  if ((turma.alunosUids ?? []).includes(aluno.uid)) return Promise.resolve();
  return updateDoc(doc(db, "turmas", turma.id), {
    alunosUids: [...(turma.alunosUids ?? []), aluno.uid],
    alunosNomes: [...(turma.alunosNomes ?? []), aluno.nome],
    convitesPendentesUids: [...(turma.convitesPendentesUids ?? []), aluno.uid],
    convitesPendentesNomes: [...(turma.convitesPendentesNomes ?? []), aluno.nome],
  });
}

/** Aluno aceita ou recusa o convite pra turma. Recusar tira ele da turma de
 * vez (alunosUids/Nomes também); aceitar só tira da lista de pendentes. */
export function responderConviteTurma(turma: Turma, uid: string, aceitar: boolean) {
  const idxConvite = (turma.convitesPendentesUids ?? []).indexOf(uid);
  const convitesPendentesUids = (turma.convitesPendentesUids ?? []).filter((u) => u !== uid);
  const convitesPendentesNomes = (turma.convitesPendentesNomes ?? []).filter(
    (_, i) => i !== idxConvite,
  );

  if (aceitar) {
    return updateDoc(doc(db, "turmas", turma.id), {
      convitesPendentesUids,
      convitesPendentesNomes,
    });
  }

  const idxAluno = (turma.alunosUids ?? []).indexOf(uid);
  const alunosUids = (turma.alunosUids ?? []).filter((u) => u !== uid);
  const alunosNomes = (turma.alunosNomes ?? []).filter((_, i) => i !== idxAluno);
  return updateDoc(doc(db, "turmas", turma.id), {
    convitesPendentesUids,
    convitesPendentesNomes,
    alunosUids,
    alunosNomes,
  });
}

export function postarMural(turma: Turma, texto: string) {
  const mensagens = [...(turma.mensagens ?? []), { texto: texto.trim(), criadoEm: Date.now() }];
  return updateDoc(doc(db, "turmas", turma.id), { mensagens });
}

/** Trabalhos de várias turmas de uma vez (resumo no Início do orientador) —
 * "in" como em eventosPermitidos, limitado a 30 turmas por consulta. */
export function useTurmaTrabalhosDasTurmas(turmaIds: string[]) {
  const [trabalhos, setTrabalhos] = useState<TurmaTrabalho[]>([]);
  const [carregando, setCarregando] = useState(true);
  const chave = turmaIds.join(",");

  useEffect(() => {
    const ids = chave ? chave.split(",") : [];
    if (ids.length === 0) {
      Promise.resolve().then(() => {
        setTrabalhos([]);
        setCarregando(false);
      });
      return;
    }
    const q = query(collection(db, "turmaTrabalhos"), where("turmaId", "in", ids.slice(0, 30)));
    return onSnapshot(q, (snap) => {
      setTrabalhos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TurmaTrabalho));
      setCarregando(false);
    });
  }, [chave]);

  return { trabalhos, carregando };
}

/** Todos os trabalhos de uma turma (visão do orientador). */
export function useTurmaTrabalhos(turmaId: string | undefined) {
  const [trabalhos, setTrabalhos] = useState<TurmaTrabalho[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!turmaId) return;
    const q = query(collection(db, "turmaTrabalhos"), where("turmaId", "==", turmaId));
    return onSnapshot(q, (snap) => {
      setTrabalhos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TurmaTrabalho));
      setCarregando(false);
    });
  }, [turmaId]);

  return { trabalhos, carregando };
}

/** O trabalho do próprio aluno dentro de uma turma (visão do aluno). */
export function useMeuTurmaTrabalho(
  turmaId: string | undefined,
  uid: string | null | undefined,
) {
  const [trabalho, setTrabalho] = useState<TurmaTrabalho | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!turmaId || !uid) return;
    const q = query(
      collection(db, "turmaTrabalhos"),
      where("turmaId", "==", turmaId),
      where("alunoUid", "==", uid),
    );
    return onSnapshot(q, (snap) => {
      setTrabalho(
        snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as TurmaTrabalho),
      );
      setCarregando(false);
    });
  }, [turmaId, uid]);

  return { trabalho, carregando };
}

export function submeterTurmaTrabalho(dados: {
  turmaId: string;
  titulo: string;
  resumo: string;
  alunoUid: string;
  alunoNome: string;
}) {
  return addDoc(collection(db, "turmaTrabalhos"), {
    ...dados,
    status: "aguardando_avaliacao",
    comentarioOrientador: null,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
}

export function corrigirTurmaTrabalho(id: string, dados: { titulo: string; resumo: string }) {
  return updateDoc(doc(db, "turmaTrabalhos", id), {
    ...dados,
    status: "aguardando_avaliacao",
    comentarioOrientador: null,
    atualizadoEm: serverTimestamp(),
  });
}

export function aprovarTurmaTrabalho(id: string) {
  return updateDoc(doc(db, "turmaTrabalhos", id), {
    status: "aprovado",
    comentarioOrientador: null,
    atualizadoEm: serverTimestamp(),
  });
}

export function solicitarRevisaoTurmaTrabalho(id: string, comentario: string) {
  return updateDoc(doc(db, "turmaTrabalhos", id), {
    status: "revisao",
    comentarioOrientador: comentario.trim(),
    atualizadoEm: serverTimestamp(),
  });
}
