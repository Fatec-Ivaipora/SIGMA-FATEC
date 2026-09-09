"use client";

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TipoAtividade } from "@/lib/atividadesAdmin";

export type Atividade = {
  id: string;
  tipo: TipoAtividade;
  texto: string;
  // Trechos de `texto` pra renderizar em negrito (nome de trabalho, evento,
  // autor) — nunca HTML, só as substrings exatas; ver renderTextoComNegrito
  // em src/app/aluno/page.tsx.
  negritos?: string[];
  trabalhoId?: string;
  eventoId?: string;
  criadoEm?: Timestamp;
};

/** Feed pessoal da tela inicial do aluno (2026-09-09) — só leitura, escrito
 * exclusivamente pelo servidor (ver src/lib/atividadesAdmin.ts). Só mostra
 * eventos a partir de quando isso foi implantado — não existe histórico
 * retroativo, já que antes disso nada era gravado. */
export function useAtividades(uid: string | undefined, quantidade = 8) {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!uid) {
      Promise.resolve().then(() => {
        setAtividades([]);
        setCarregando(false);
      });
      return;
    }
    const q = query(
      collection(db, "atividades"),
      where("uid", "==", uid),
      orderBy("criadoEm", "desc"),
      limit(quantidade),
    );
    return onSnapshot(q, (snap) => {
      setAtividades(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Atividade));
      setCarregando(false);
    });
  }, [uid, quantidade]);

  return { atividades, carregando };
}
