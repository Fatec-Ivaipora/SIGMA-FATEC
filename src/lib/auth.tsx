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
  // Coletado no cadastro desde 2026-09-03 (antes só existia pra quem pagou
  // inscrição via Asaas, que grava aqui também — ver /api/asaas/cobranca).
  // Precisa ser um CPF de verdade: é exigido pelo lançamento no Edubox
  // (MEC), que valida por dígito verificador e imprime no certificado.
  cpf?: string;
  // Idem — exigido pelo Edubox (trigger deles rejeita insert sem data de
  // nascimento válida). Formato ISO "AAAA-MM-DD". Contas criadas antes de
  // 2026-09-03 não têm isso preenchido; pedir pra completar em Configurações
  // antes de tentar lançar a pessoa no Edubox.
  dataNascimento?: string;
  // Conjunto completo de capacidades "de avaliação" da pessoa (2026-08-26)
  // — inclui o próprio `papel` primário quando ele já é um dos três de
  // PAPEIS_AVALIACAO. Ausente = conta antiga, equivale a [papel] se `papel`
  // for um desses três, senão []. Ver temPapel() abaixo — é ele que sabe ler
  // isso, nunca comparar papeisAvaliacao direto.
  papeisAvaliacao?: PapelAvaliacao[];
  // true só em contas criadas pelo admin (senha gerada na hora, nunca
  // escolhida pela pessoa) — força a troca no primeiro login, ver
  // SenhaTemporariaGate. Ausente/false = login normal.
  senhaTemporaria?: boolean;
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
