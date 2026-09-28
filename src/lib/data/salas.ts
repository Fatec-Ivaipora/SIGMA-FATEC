"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/** salas/{id} (2026-09-17, catálogo único desde 2026-09-28) — sala física do
 * campus, cadastrada uma vez só e reaproveitada em qualquer evento (antes
 * era presa a um eventoId, tinha que recadastrar toda vez). Qual sala desse
 * catálogo vale pra qual evento fica em evento.salasIds (ver
 * src/lib/data/eventos.ts) — a divisão em sessões (horário + modalidade +
 * área) continua sendo o algoritmo automático de ensalamento, ver
 * src/lib/data/sessoes.ts. */
export type SalaEnsalamento = {
  id: string;
  nome: string;
};

export function useSalasCatalogo() {
  const [salas, setSalas] = useState<SalaEnsalamento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    return onSnapshot(collection(db, "salas"), (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SalaEnsalamento);
      // Ordem "natural" (1, 2, 10, 13...) em vez de alfabética pura (1, 10,
      // 13, 2...) — os nomes são majoritariamente números.
      lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
      setSalas(lista);
      setCarregando(false);
    });
  }, []);

  return { salas, carregando };
}

export async function criarSala(dados: { nome: string }) {
  await addDoc(collection(db, "salas"), {
    nome: dados.nome,
    criadoEm: serverTimestamp(),
  });
}

export async function removerSala(salaId: string) {
  await deleteDoc(doc(db, "salas", salaId));
}
