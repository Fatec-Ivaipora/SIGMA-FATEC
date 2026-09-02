"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  or,
  query,
  updateDoc,
  where,
  type Query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { temPapel, type PerfilUsuario } from "@/lib/auth";

export type TrabalhoStatus =
  | "submissao"
  | "aguardando_avaliacao"
  | "revisao"
  | "avaliado"
  | "aguardando_apresentacao"
  | "apresentado"
  | "aceito"
  | "nao_aceito";

// Critérios do edital (item 6.1): cada um recebe uma nota de 1 a 5 (item
// 6.2); notaAvaliador guarda a SOMA dos cinco (5 a 25), usada pra ranquear
// os resumos mais bem pontuados.
export type NotasCriterios = {
  suficiencia: number;
  coerencia: number;
  estruturaTexto: number;
  clarezaPrecisao: number;
  aplicabilidadeRelevancia: number;
};

// Critérios da etapa de Apresentação (2026-08-26), pontuados pelo moderador
// — mesmo formato do avaliador (1 a 5 cada, soma 5-25). PROVISÓRIO: o
// usuário ainda não passou a lista real de critérios do edital pra
// apresentação; os nomes abaixo são placeholder (ver CRITERIOS_APRESENTACAO
// em src/app/avaliador/trabalhos/page.tsx pra trocar quando ele mandar).
export type NotasCriteriosApresentacao = {
  dominioConteudo: number;
  clarezaComunicacao: number;
  usoDoTempo: number;
  qualidadeMaterial: number;
  posturaSeguranca: number;
};

export type Trabalho = {
  id: string;
  titulo: string;
  alunoUid: string;
  alunoNome: string;
  eventoId: string;
  areaTematica: string;
  // Como o trabalho será apresentado (2026-09-01) — Oral (sala reservada,
  // com slides, tempo de perguntas no final) ou Roda de Conversa (banner
  // impresso, apresentador junto ao material, formato mais interativo).
  // Escolhido pelo aluno na submissão.
  modalidadeApresentacao?: "oral" | "roda_conversa";
  nomeOrientador?: string;
  resumo?: string;
  // Colegas adicionados na submissão (RF-08) — só leem o trabalho, não podem
  // editá-lo/reenviá-lo (isso continua exclusivo de alunoUid). Entram em
  // participantesUids/Nomes já na submissão, mas ficam em convitesPendentes
  // até aceitarem ou recusarem o convite (RF-52, 2026-08-25) — recusar
  // remove o colega de participantesUids/Nomes também.
  participantesUids?: string[];
  participantesNomes?: string[];
  convitesPendentes?: string[];
  status: TrabalhoStatus;
  avaliadorUid?: string | null;
  avaliadorNome?: string | null;
  // Soma dos 5 critérios (NotasCriterios), 5 a 25 — ver notasCriterios pro
  // detalhamento por critério.
  notaAvaliador?: number | null;
  notasCriterios?: NotasCriterios | null;
  comentarioRevisao?: string | null;
  // Etapa Apresentação (2026-08-26) — moderador designado e sua nota, mesmo
  // padrão de avaliadorUid/notaAvaliador acima.
  moderadorUid?: string | null;
  moderadorNome?: string | null;
  notaModerador?: number | null;
  notasCriteriosApresentacao?: NotasCriteriosApresentacao | null;
  // Controla quando o certificado/declaração desse trabalho aparece pro
  // aluno/avaliador/moderador (2026-08-28) — chegar em "aceito" não libera
  // sozinho; a organização decide o momento clicando "Liberar certificado"
  // na aba Resultado Final (ver trabalhos/page.tsx).
  certificadoLiberado?: boolean;
  atualizadoEm?: unknown;
};

/** Lê trabalhos do Firestore, escopado por papel: admin vê tudo; organizacao só
 * os eventos em que atua (RN-15); avaliador só os que lhe foram designados;
 * aluno só os que ele mesmo submeteu. */
export function useTrabalhos(
  perfil: PerfilUsuario | null | undefined,
  uid: string | null | undefined,
) {
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil || !uid) return;

    const ref = collection(db, "trabalhos");
    let q: Query;

    if (perfil.papel === "admin") {
      q = query(ref);
    } else if (perfil.papel === "organizacao") {
      if (!perfil.eventosPermitidos || perfil.eventosPermitidos.length === 0) {
        Promise.resolve().then(() => {
          setTrabalhos([]);
          setCarregando(false);
        });
        return;
      }
      q = query(ref, where("eventoId", "in", perfil.eventosPermitidos.slice(0, 30)));
    } else if (
      temPapel(perfil, "avaliador") ||
      temPapel(perfil, "orientador") ||
      temPapel(perfil, "moderador")
    ) {
      // Papéis combináveis (2026-08-26, ver PAPEIS_AVALIACAO em auth.tsx) —
      // uma pessoa pode ser avaliadorUid de uns trabalhos e moderadorUid de
      // outros ao mesmo tempo; a tela em si separa por aba (ver
      // src/app/avaliador/trabalhos/page.tsx).
      q = query(ref, or(where("avaliadorUid", "==", uid), where("moderadorUid", "==", uid)));
    } else {
      // Dono do trabalho ou colega adicionado como participante (RF-08).
      q = query(
        ref,
        or(where("alunoUid", "==", uid), where("participantesUids", "array-contains", uid)),
      );
    }

    return onSnapshot(q, (snap) => {
      setTrabalhos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trabalho));
      setCarregando(false);
    });
  }, [perfil, uid]);

  return { trabalhos, carregando };
}

export function atualizarTrabalho(trabalhoId: string, dados: Partial<Trabalho>) {
  return updateDoc(doc(db, "trabalhos", trabalhoId), dados);
}

/** Colega responde ao convite de participação (RF-52). Aceitar só tira o
 * convite da lista de pendentes; recusar também remove o colega de
 * participantesUids/Nomes — deixa de aparecer como colega desse trabalho. */
export function responderConvite(trabalho: Trabalho, uid: string, aceitar: boolean) {
  const convitesPendentes = (trabalho.convitesPendentes ?? []).filter((u) => u !== uid);

  if (aceitar) {
    return atualizarTrabalho(trabalho.id, { convitesPendentes });
  }

  const indice = (trabalho.participantesUids ?? []).indexOf(uid);
  const participantesUids = (trabalho.participantesUids ?? []).filter((u) => u !== uid);
  const participantesNomes = (trabalho.participantesNomes ?? []).filter(
    (_, i) => i !== indice,
  );
  return atualizarTrabalho(trabalho.id, {
    convitesPendentes,
    participantesUids,
    participantesNomes,
  });
}
