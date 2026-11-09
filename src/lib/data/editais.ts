"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Cards públicos de edital (2026-09-04) — listados em /editais (sem login),
// cada card abre o PDF pra leitura. Gerido só pelo admin em
// /editais/gerenciar (ver firestore.rules).
export type Edital = {
  id: string;
  titulo: string;
  descricao?: string;
  arquivoUrl: string;
  arquivoNome?: string;
  criadoEm?: Timestamp;
};

export function useEditais() {
  const [editais, setEditais] = useState<Edital[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "editais"), orderBy("criadoEm", "desc"));
    return onSnapshot(q, (snap) => {
      setEditais(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Edital));
      setCarregando(false);
    });
  }, []);

  return { editais, carregando };
}

export async function criarEdital(dados: {
  titulo: string;
  descricao?: string;
  arquivoUrl: string;
  arquivoNome?: string;
}) {
  // Nunca grava `descricao: undefined` (2026-11-09, achado real — "fica
  // falando que não é possível" ao subir o PDF do ensalamento em
  // /editais/gerenciar). O Firestore SDK recusa addDoc com um campo
  // `undefined` no objeto (throw síncrono, não é falha de rede nem de
  // permissão) — se a descrição ficasse em branco (campo opcional), o
  // upload do PDF pro Storage já tinha ido, mas o card nunca era criado.
  const { descricao, ...resto } = dados;
  await addDoc(collection(db, "editais"), {
    ...resto,
    ...(descricao ? { descricao } : {}),
    criadoEm: serverTimestamp(),
  });
}

export async function excluirEdital(id: string) {
  await deleteDoc(doc(db, "editais", id));
}
