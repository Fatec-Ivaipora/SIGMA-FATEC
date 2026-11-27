"use client";

import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/** suplentesEvento/{eventoId}::{uid} (2026-11-27, pedido explícito do
 * usuário) — professor (avaliador/orientador/moderador) de sobreaviso pra
 * um evento de TCC, caso precise substituir alguém no dia da banca. Só um
 * cargo marcado por fora, atribuído pela organização/admin (mesmo padrão
 * de monitoresEvento em src/lib/data/monitores.ts, só que mirando
 * professor, não aluno) — não dá acesso extra nenhum no sistema, só
 * aparece com a tag "Suplente" na frente do nome nas telas que leem isso. */
export type SuplenteEvento = {
  id: string;
  eventoId: string;
  uid: string;
  nome: string;
  email: string;
};

export function useSuplentesDoEvento(eventoId: string | undefined) {
  const [suplentes, setSuplentes] = useState<SuplenteEvento[]>([]);
  const [carregando, setCarregando] = useState(!!eventoId);

  useEffect(() => {
    if (!eventoId) {
      Promise.resolve().then(() => {
        setSuplentes([]);
        setCarregando(false);
      });
      return;
    }
    const q = query(collection(db, "suplentesEvento"), where("eventoId", "==", eventoId));
    return onSnapshot(q, (snap) => {
      setSuplentes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SuplenteEvento));
      setCarregando(false);
    });
  }, [eventoId]);

  return { suplentes, carregando };
}

export async function adicionarSuplente(
  eventoId: string,
  pessoa: { uid: string; nome: string; email: string },
) {
  await setDoc(doc(db, "suplentesEvento", `${eventoId}::${pessoa.uid}`), {
    eventoId,
    uid: pessoa.uid,
    nome: pessoa.nome,
    email: pessoa.email,
    criadoEm: serverTimestamp(),
  });
}

export async function removerSuplente(eventoId: string, uid: string) {
  await deleteDoc(doc(db, "suplentesEvento", `${eventoId}::${uid}`));
}

export type ProfessorParaBusca = { uid: string; nome: string; email: string };

/** Busca entre PROFESSORES (avaliador/orientador/moderador — ou o cargo
 * neutro "professor", 2026-11-27: é literalmente a porta de entrada pra
 * cadastrar alguém SEM nenhum desses três ainda e só depois marcar como
 * suplente, ver comentário em src/lib/auth.tsx) pra marcar suplente — não
 * precisa já estar atribuído a esse evento (o ponto é ficar de reserva,
 * independente de já fazer parte da banca ou não). Carrega a coleção
 * usuarios inteira (só roda em tela de admin/organização, já autenticada —
 * mesmo padrão de useUsuariosPorPapelCombinavel em src/lib/data/usuarios.ts),
 * filtra por qualquer um dos 3 papéis combináveis (papel primário ou extra
 * em papeisAvaliacao) OU papel === "professor". */
export function useProfessoresParaBusca() {
  const [professores, setProfessores] = useState<ProfessorParaBusca[]>([]);

  useEffect(() => {
    let cancelado = false;
    getDocs(collection(db, "usuarios")).then((snap) => {
      if (cancelado) return;
      const papeisProfessor = new Set(["avaliador", "orientador", "moderador", "professor"]);
      setProfessores(
        snap.docs
          .map(
            (d) =>
              ({ uid: d.id, ...d.data() }) as {
                uid: string;
                nome: string;
                email: string;
                papel?: string;
                papeisAvaliacao?: string[];
              },
          )
          .filter(
            (u) =>
              papeisProfessor.has(u.papel ?? "") ||
              (u.papeisAvaliacao ?? []).some((p) => papeisProfessor.has(p)),
          )
          .map((u) => ({ uid: u.uid, nome: u.nome, email: u.email })),
      );
    });
    return () => {
      cancelado = true;
    };
  }, []);

  return professores;
}
