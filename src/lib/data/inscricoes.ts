"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

export type InscricaoEvento = {
  id: string;
  eventoId: string;
  uid: string;
  nome: string;
  email: string;
  vinculoFatec: boolean;
  valor: number;
  // "interesse" = clicou em Participar, ainda não iniciou pagamento nenhum
  // (2026-08-26) — é esse status mínimo que faz a trilha/o fluxo do evento
  // aparecer no card do aluno; sem nenhum doc, só aparece o botão Participar.
  status: "interesse" | "pendente" | "pago";
};

/** Status da própria Etapa 1 (pagamento) do aluno logado num evento. */
export function useMinhaInscricao(eventoId: string | undefined, uid: string | undefined) {
  const [inscricao, setInscricao] = useState<InscricaoEvento | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!eventoId || !uid) {
      Promise.resolve().then(() => {
        setInscricao(null);
        setCarregando(false);
      });
      return;
    }
    return onSnapshot(
      doc(db, "inscricoesEvento", `${eventoId}::${uid}`),
      (snap) => {
        setInscricao(snap.exists() ? ({ id: snap.id, ...snap.data() } as InscricaoEvento) : null);
        setCarregando(false);
      },
      // Nunca deixa o card preso em "carregando" se a leitura falhar por
      // qualquer motivo (regra desatualizada, offline, etc).
      () => {
        setInscricao(null);
        setCarregando(false);
      },
    );
  }, [eventoId, uid]);

  return { inscricao, carregando };
}

/** Todas as próprias inscrições do aluno logado, em qualquer evento —
 * usado no painel inicial (seção "Eventos inscritos", 2026-09-04) pra saber
 * o status de pagamento de cada evento sem precisar um hook por evento
 * (useMinhaInscricao é por eventoId só). Regra já permite (uid ==
 * request.auth.uid), ver firestore.rules. */
export function useMinhasInscricoes(uid: string | undefined) {
  const [inscricoes, setInscricoes] = useState<Map<string, InscricaoEvento>>(new Map());
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!uid) {
      Promise.resolve().then(() => {
        setInscricoes(new Map());
        setCarregando(false);
      });
      return;
    }
    const q = query(collection(db, "inscricoesEvento"), where("uid", "==", uid));
    return onSnapshot(
      q,
      (snap) => {
        const mapa = new Map<string, InscricaoEvento>();
        snap.forEach((d) => {
          const dados = { id: d.id, ...d.data() } as InscricaoEvento;
          mapa.set(dados.eventoId, dados);
        });
        setInscricoes(mapa);
        setCarregando(false);
      },
      () => {
        setInscricoes(new Map());
        setCarregando(false);
      },
    );
  }, [uid]);

  return { inscricoes, carregando };
}

/** Todos os inscritos de um evento, qualquer status (organizador/admin) — RF:
 * modal "Inscritos". Pagamento não bloqueia mais inscrição/trabalho
 * (2026-08-31, pedido da diretoria) — por isso não filtra mais por "pago";
 * quem chama decide o que fazer com o status de cada um. */
export function useInscritosDoEvento(eventoId: string | undefined) {
  const [inscritos, setInscritos] = useState<InscricaoEvento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!eventoId) {
      Promise.resolve().then(() => {
        setInscritos([]);
        setCarregando(false);
      });
      return;
    }
    const q = query(collection(db, "inscricoesEvento"), where("eventoId", "==", eventoId));
    return onSnapshot(q, (snap) => {
      setInscritos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InscricaoEvento));
      setCarregando(false);
    });
  }, [eventoId]);

  return { inscritos, carregando };
}

/** Uids de todo mundo inscrito num evento, qualquer status — usado pra
 * restringir a busca de colega (SubmeterTrabalhoModal) a quem já pelo menos
 * demonstrou interesse no evento (pagamento não é mais pré-requisito).
 * Busca via /api/inscricoes/uids (Admin SDK) em vez de query direta no
 * Firestore: um aluno comum só pode LER a própria inscrição pelas Security
 * Rules — listar a coleção inteira só por eventoId (sem uid) é negado pra
 * quem não é admin/organização (2026-08-31, ver rota da API). */
export function useInscritosUids(eventoId: string | undefined): Set<string> {
  const [uids, setUids] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!eventoId) {
      Promise.resolve().then(() => setUids(new Set()));
      return;
    }
    let cancelado = false;
    (async () => {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;
      const res = await fetch(
        `/api/inscricoes/uids?eventoId=${encodeURIComponent(eventoId)}`,
        { headers: { Authorization: `Bearer ${idToken}` } },
      );
      if (!res.ok || cancelado) return;
      const corpo = (await res.json()) as { uids?: string[] };
      setUids(new Set(corpo.uids ?? []));
    })();
    return () => {
      cancelado = true;
    };
  }, [eventoId]);

  return uids;
}
