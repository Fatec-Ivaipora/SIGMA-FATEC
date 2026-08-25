"use client";

import { useEffect, useState } from "react";
import { collection, documentId, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PerfilUsuario } from "@/lib/auth";

export type Evento = {
  id: string;
  nome: string;
  descricao?: string;
  periodoSubmissao?: string;
  periodoAvaliacao?: string;
  destaque?: boolean;
  imagemDestaqueUrl?: string | null;
  areasTematicas?: string[];
  // Se true, participantes externos (não-alunos da Fatec) podem se inscrever.
  // Padrão (ausente) = só alunos da Fatec, mantendo o comportamento anterior
  // a essa opção para eventos já cadastrados.
  aceitaExternos?: boolean;
};

/** Lê eventos do Firestore, escopado por RN-15: admin vê tudo; organizacao/avaliador só os seus. */
export function useEventos(perfil: PerfilUsuario | null | undefined) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil) return;

    const restrito = perfil.papel !== "admin";
    if (restrito && (!perfil.eventosPermitidos || perfil.eventosPermitidos.length === 0)) {
      Promise.resolve().then(() => {
        setEventos([]);
        setCarregando(false);
      });
      return;
    }

    const ref = collection(db, "eventos");
    const q = restrito
      ? query(ref, where(documentId(), "in", perfil.eventosPermitidos!.slice(0, 30)))
      : query(ref);

    return onSnapshot(q, (snap) => {
      setEventos(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Evento),
      );
      setCarregando(false);
    });
  }, [perfil]);

  return { eventos, carregando };
}

/** Lê todos os eventos, sem escopo — para o aluno, que não é restrito por
 * RN-15 (RN-15 só se aplica a organizacao/avaliador). Exige estar logado. */
export function useEventosPublicos() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    return onSnapshot(collection(db, "eventos"), (snap) => {
      setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Evento));
      setCarregando(false);
    });
  }, []);

  return { eventos, carregando };
}
