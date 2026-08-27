"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type Papel = "aluno" | "avaliador" | "organizacao" | "admin" | "orientador" | "moderador";

// Só esses três se combinam entre si num mesmo usuário (2026-08-26) — ex.:
// avaliador+orientador, ou orientador+moderador. aluno/organizacao/admin
// continuam sendo um papel só, sem se misturar com os demais.
export const PAPEIS_AVALIACAO = ["avaliador", "orientador", "moderador"] as const;
export type PapelAvaliacao = (typeof PAPEIS_AVALIACAO)[number];

export type AtribuicaoEvento = {
  eventoId: string;
  // Um avaliador pode cobrir mais de uma área temática no mesmo evento
  // (2026-08-25) — usado também pra dividir o envio em lote entre os
  // avaliadores de uma área (ver src/app/trabalhos/page.tsx).
  areasTematicas?: string[];
};

export type PerfilUsuario = {
  nome: string;
  email: string;
  papel: Papel;
  atribuicoesEventos?: AtribuicaoEvento[];
  // Lista simples de eventoIds, espelhando atribuicoesEventos — existe só
  // porque as Firestore Security Rules não têm .map()/.filter() para extrair
  // eventoId de dentro de atribuicoesEventos. Manter em sincronia sempre que
  // atribuicoesEventos for editado (ver firestore.rules).
  eventosPermitidos?: string[];
  // Só relevante para papel "aluno". true (ou ausente, para contas antigas)
  // = aluno matriculado na Fatec, com RA validado, sem restrição de evento.
  // false = participante externo, só pode submeter em eventos com
  // aceitaExternos == true (ver firestore.rules e Evento.aceitaExternos).
  vinculoFatec?: boolean;
  ra?: string;
  curso?: string;
  // Salvo pelo servidor (rota /api/asaas/cobranca) na primeira cobrança do
  // usuário — reusado nas próximas pra não pedir CPF de novo (2026-08-26).
  cpf?: string;
  // Conjunto completo de capacidades "de avaliação" da pessoa (2026-08-26)
  // — inclui o próprio `papel` primário quando ele já é um dos três de
  // PAPEIS_AVALIACAO. Ausente = conta antiga, equivale a [papel] se `papel`
  // for um desses três, senão []. Ver temPapel() abaixo — é ele que sabe ler
  // isso, nunca comparar papeisAvaliacao direto.
  papeisAvaliacao?: PapelAvaliacao[];
};

export const ROTA_POR_PAPEL: Record<Papel, string> = {
  aluno: "/aluno",
  avaliador: "/avaliador",
  organizacao: "/dashboard",
  admin: "/dashboard",
  orientador: "/orientador",
  moderador: "/avaliador",
};

/** Único jeito correto de checar se alguém "tem" um papel — cobre tanto o
 * papel primário quanto os extras de papeisAvaliacao (avaliador/orientador/
 * moderador). Pra aluno/organizacao/admin é só a comparação direta mesmo. */
export function temPapel(perfil: PerfilUsuario | null | undefined, papel: Papel): boolean {
  if (!perfil) return false;
  if (perfil.papel === papel) return true;
  if (!PAPEIS_AVALIACAO.includes(papel as PapelAvaliacao)) return false;
  return !!perfil.papeisAvaliacao?.includes(papel as PapelAvaliacao);
}

type AuthState = {
  user: User | null;
  perfil: PerfilUsuario | null;
  carregando: boolean;
};

const AuthContext = createContext<AuthState>({
  user: null,
  perfil: null,
  carregando: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authPronto, setAuthPronto] = useState(false);
  // undefined = ainda não veio resposta do Firestore para este usuário
  const [perfil, setPerfil] = useState<PerfilUsuario | null | undefined>(
    undefined,
  );

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthPronto(true);
      if (!u) setPerfil(null);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "usuarios", user.uid), (snap) => {
      setPerfil(snap.exists() ? (snap.data() as PerfilUsuario) : null);
    });
  }, [user]);

  const carregando = !authPronto || (!!user && perfil === undefined);

  return (
    <AuthContext.Provider value={{ user, perfil: perfil ?? null, carregando }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function sair() {
  return signOut(auth);
}
