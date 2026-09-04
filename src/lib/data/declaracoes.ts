"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Biblioteca pública de declarações antigas (2026-09-04) — hierarquia de 2
// níveis: categoria (ex.: "2025") > declaração (ex.: "Moderadores -
// Avaliadores"), cada declaração é um PDF único. Pública (sem login, ver
// firestore.rules), gerida só pelo admin em /declaracoes.
export type DeclaracaoCategoria = { id: string; nome: string };
export type Declaracao = {
  id: string;
  categoriaId: string;
  nome: string;
  arquivoUrl: string;
  arquivoNome?: string;
};
export type CategoriaComDeclaracoes = DeclaracaoCategoria & { itens: Declaracao[] };

function useDeclaracaoCategoriasRaw() {
  const [categorias, setCategorias] = useState<DeclaracaoCategoria[]>([]);
  useEffect(() => {
    return onSnapshot(collection(db, "declaracaoCategorias"), (snap) => {
      setCategorias(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DeclaracaoCategoria));
    });
  }, []);
  return categorias;
}

function useDeclaracoesRaw() {
  const [declaracoes, setDeclaracoes] = useState<Declaracao[]>([]);
  useEffect(() => {
    return onSnapshot(collection(db, "declaracoes"), (snap) => {
      setDeclaracoes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Declaracao));
    });
  }, []);
  return declaracoes;
}

/** Categorias com os itens já agrupados dentro — usado tanto no dropdown
 * público (home) quanto na tela de administração, pra não duplicar a lógica
 * de agrupar. Categoria mais recente primeiro (nome decrescente — funciona
 * bem pra anos "2025"/"2024"/...); itens em ordem alfabética. */
export function useDeclaracoesAgrupadas() {
  const categorias = useDeclaracaoCategoriasRaw();
  const declaracoes = useDeclaracoesRaw();
  return useMemo<CategoriaComDeclaracoes[]>(
    () =>
      [...categorias]
        .sort((a, b) => b.nome.localeCompare(a.nome))
        .map((cat) => ({
          ...cat,
          itens: declaracoes
            .filter((d) => d.categoriaId === cat.id)
            .sort((a, b) => a.nome.localeCompare(b.nome)),
        })),
    [categorias, declaracoes],
  );
}

export async function criarCategoriaDeclaracao(nome: string) {
  await addDoc(collection(db, "declaracaoCategorias"), { nome: nome.trim() });
}

/** Apaga a categoria e todas as declarações dentro dela (não apaga os PDFs
 * do Storage — órfãos lá não custam nada e o admin pode reaproveitar o link
 * se precisar; mesma cautela usada noutros lugares do app pra não fazer
 * limpeza de Storage arriscada demais). */
export async function excluirCategoriaDeclaracao(categoriaId: string, declaracaoIds: string[]) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "declaracaoCategorias", categoriaId));
  declaracaoIds.forEach((id) => batch.delete(doc(db, "declaracoes", id)));
  await batch.commit();
}

export async function criarDeclaracao(dados: {
  categoriaId: string;
  nome: string;
  arquivoUrl: string;
  arquivoNome?: string;
}) {
  await addDoc(collection(db, "declaracoes"), dados);
}

export async function excluirDeclaracao(id: string) {
  await deleteDoc(doc(db, "declaracoes", id));
}
