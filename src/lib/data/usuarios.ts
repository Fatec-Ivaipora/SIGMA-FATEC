"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AtribuicaoEvento, Papel } from "@/lib/auth";

export type UsuarioRegistro = {
  uid: string;
  nome: string;
  email: string;
  papel: Papel;
  atribuicoesEventos?: AtribuicaoEvento[];
  eventosPermitidos?: string[];
  vinculoFatec?: boolean;
  ra?: string;
  curso?: string;
};

/** Lista todos os usuários cadastrados (RF-26: organizacao/admin podem ver). */
export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioRegistro[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    return onSnapshot(collection(db, "usuarios"), (snap) => {
      setUsuarios(
        snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UsuarioRegistro),
      );
      setCarregando(false);
    });
  }, []);

  return { usuarios, carregando };
}

export type AlunoParaBusca = { uid: string; nome: string; email: string };

/** Lista contas de aluno (Fatec ou externo) para o aluno buscar colegas na
 * hora de submeter um trabalho (RF-08), ou pro orientador convidar pra uma
 * turma do Projeto Integrador (RF-53 — aí só Fatec, `apenasFatec`, já que
 * participante externo não tem essa vertente). Um aluno só pode ler outros
 * usuarios com papel "aluno" (ver firestore.rules) — nunca
 * avaliador/organizacao/admin/orientador. */
export function useAlunosParaBusca(
  meuUid: string | null | undefined,
  opcoes?: { apenasFatec?: boolean },
) {
  const [alunos, setAlunos] = useState<AlunoParaBusca[]>([]);
  const apenasFatec = opcoes?.apenasFatec ?? false;

  useEffect(() => {
    const q = query(collection(db, "usuarios"), where("papel", "==", "aluno"));
    return onSnapshot(q, (snap) => {
      setAlunos(
        snap.docs
          .filter((d) => d.id !== meuUid)
          .filter((d) => !apenasFatec || d.data().vinculoFatec !== false)
          .map((d) => ({ uid: d.id, nome: d.data().nome, email: d.data().email })),
      );
    });
  }, [meuUid, apenasFatec]);

  return alunos;
}

export function atualizarAtribuicoesUsuario(
  uid: string,
  atribuicoesEventos: AtribuicaoEvento[],
) {
  return updateDoc(doc(db, "usuarios", uid), {
    atribuicoesEventos,
    eventosPermitidos: atribuicoesEventos.map((a) => a.eventoId),
  });
}

