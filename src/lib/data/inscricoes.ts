"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

/** Inscritos pagos de um evento (organizador/admin) — RF: modal "Inscritos". */
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
    const q = query(
      collection(db, "inscricoesEvento"),
      where("eventoId", "==", eventoId),
      where("status", "==", "pago"),
    );
    return onSnapshot(q, (snap) => {
      setInscritos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InscricaoEvento));
      setCarregando(false);
    });
  }, [eventoId]);

  return { inscritos, carregando };
}

/** Só os uids pagos de um evento — usado pra restringir a busca de colega
 * (SubmeterTrabalhoModal) aos que já completaram a Etapa 1. */
export function useInscritosPagosUids(eventoId: string | undefined): Set<string> {
  const { inscritos } = useInscritosDoEvento(eventoId);
  return useMemo(() => new Set(inscritos.map((i) => i.uid)), [inscritos]);
}
