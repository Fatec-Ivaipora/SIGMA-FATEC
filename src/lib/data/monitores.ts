"use client";

import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/** monitoresEvento/{eventoId}::{uid} (2026-09-01) — aluno marcado pela
 * organização/admin como monitor de um evento (ajuda na operação, não avalia
 * nem submete trabalho). Não precisa fazer nada no sistema além de já ter
 * conta — o cargo em si é atribuído aqui, de fora. certificadoLiberado segue
 * o mesmo botão "Emitir certificados" da aba Resultado Final. */
export type MonitorEvento = {
  id: string;
  eventoId: string;
  uid: string;
  nome: string;
  email: string;
  certificadoLiberado?: boolean;
};

export function useMonitoresDoEvento(eventoId: string | undefined) {
  const [monitores, setMonitores] = useState<MonitorEvento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!eventoId) {
      Promise.resolve().then(() => {
        setMonitores([]);
        setCarregando(false);
      });
      return;
    }
    const q = query(collection(db, "monitoresEvento"), where("eventoId", "==", eventoId));
    return onSnapshot(q, (snap) => {
      setMonitores(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MonitorEvento));
      setCarregando(false);
    });
  }, [eventoId]);

  return { monitores, carregando };
}

/** Todos os eventos em que o aluno logado é monitor — tela de Certificações
 * (2026-09-01). Query só por uid == o meu, então a regra do Firestore
 * consegue verificar estaticamente (mesmo padrão de useTrabalhos p/ aluno). */
export function useMinhasMonitorias(uid: string | undefined) {
  const [monitorias, setMonitorias] = useState<MonitorEvento[]>([]);

  useEffect(() => {
    if (!uid) {
      Promise.resolve().then(() => setMonitorias([]));
      return;
    }
    const q = query(collection(db, "monitoresEvento"), where("uid", "==", uid));
    return onSnapshot(q, (snap) => {
      setMonitorias(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MonitorEvento));
    });
  }, [uid]);

  return monitorias;
}

/** Se/como o aluno logado é monitor de um evento específico — usado na tela
 * de Certificações dele pra saber se tem uma declaração de monitor esperando. */
export function useMinhaMonitoria(eventoId: string | undefined, uid: string | undefined) {
  const [monitoria, setMonitoria] = useState<MonitorEvento | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!eventoId || !uid) {
      Promise.resolve().then(() => {
        setMonitoria(null);
        setCarregando(false);
      });
      return;
    }
    return onSnapshot(
      doc(db, "monitoresEvento", `${eventoId}::${uid}`),
      (snap) => {
        setMonitoria(snap.exists() ? ({ id: snap.id, ...snap.data() } as MonitorEvento) : null);
        setCarregando(false);
      },
      () => {
        setMonitoria(null);
        setCarregando(false);
      },
    );
  }, [eventoId, uid]);

  return { monitoria, carregando };
}

export async function adicionarMonitor(
  eventoId: string,
  aluno: { uid: string; nome: string; email: string },
) {
  await setDoc(doc(db, "monitoresEvento", `${eventoId}::${aluno.uid}`), {
    eventoId,
    uid: aluno.uid,
    nome: aluno.nome,
    email: aluno.email,
    criadoEm: serverTimestamp(),
  });
}

export async function removerMonitor(eventoId: string, uid: string) {
  await deleteDoc(doc(db, "monitoresEvento", `${eventoId}::${uid}`));
}
