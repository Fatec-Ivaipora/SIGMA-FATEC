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
  await addDoc(collection(db, "editais"), { ...dados, criadoEm: serverTimestamp() });
}

export async function excluirEdital(id: string) {
  await deleteDoc(doc(db, "editais", id));
}
