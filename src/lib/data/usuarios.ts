"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AtribuicaoEvento, Papel, PapelAvaliacao } from "@/lib/auth";

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
  papeisAvaliacao?: PapelAvaliacao[];
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
 * participante externo não tem essa vertente). Lê usuariosPublicos (2026-09-08,
 * corrige achado do pentest) — um espelho só com nome/email/vinculoFatec de
 * quem é aluno, nunca o doc usuarios/{uid} inteiro (que tem cpf/dataNascimento).
 * Por isso não precisa mais filtrar por papel aqui: só aluno tem espelho. */
export function useAlunosParaBusca(
  meuUid: string | null | undefined,
  opcoes?: {
    apenasFatec?: boolean;
    // Taxa de inscrição (2026-08-26): quando definido, só alunos com uid
    // presente no Set aparecem na busca — usado pra restringir convite de
    // colega aos que já completaram a Etapa 1 (pagamento) do evento.
    restringirA?: Set<string>;
  },
) {
  const [alunos, setAlunos] = useState<AlunoParaBusca[]>([]);
  const apenasFatec = opcoes?.apenasFatec ?? false;
  const restringirA = opcoes?.restringirA;

  useEffect(() => {
    return onSnapshot(collection(db, "usuariosPublicos"), (snap) => {
      setAlunos(
        snap.docs
          .filter((d) => d.id !== meuUid)
          .filter((d) => !apenasFatec || d.data().vinculoFatec !== false)
          .filter((d) => !restringirA || restringirA.has(d.id))
          .map((d) => ({ uid: d.id, nome: d.data().nome, email: d.data().email })),
      );
    });
  }, [meuUid, apenasFatec, restringirA]);

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

/** Papéis combináveis (2026-08-26) — admin adiciona/retira avaliador/
 * orientador/moderador de um usuário. Sempre inclui o papel primário na
 * lista, pra ficar consistente com o que temPapel()/firestore.rules esperam. */
export function atualizarPapeisAvaliacaoUsuario(
  uid: string,
  papel: Papel,
  papeisAvaliacao: PapelAvaliacao[],
) {
  const conjunto = new Set<PapelAvaliacao>(papeisAvaliacao);
  if (["avaliador", "orientador", "moderador"].includes(papel)) {
    conjunto.add(papel as PapelAvaliacao);
  }
  return updateDoc(doc(db, "usuarios", uid), {
    papeisAvaliacao: Array.from(conjunto),
  });
}

