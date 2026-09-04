"use client";

import type { User } from "firebase/auth";

// Chamadas "melhor esforço" pras rotas /api/mail/* (2026-09-04) — nunca
// bloqueiam nem quebram a ação principal (submeter trabalho, dar nota,
// etc.) se o envio de e-mail falhar por qualquer motivo; por isso não são
// awaited pelos call sites e engolem o próprio erro.

async function chamar(user: User, rota: string, corpo: unknown) {
  try {
    const idToken = await user.getIdToken();
    await fetch(`/api/mail/${rota}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
  } catch {
    // melhor esforço — falha de e-mail nunca deve quebrar o fluxo principal
  }
}

export function notificarConviteColega(user: User, trabalhoId: string, colegaUid: string) {
  void chamar(user, "convite-colega", { trabalhoId, colegaUid });
}

export function notificarConviteTurma(user: User, turmaId: string, alunoUid: string) {
  void chamar(user, "convite-turma", { turmaId, alunoUid });
}

export type TipoStatusTrabalho = "submetido" | "revisao" | "avaliado" | "aceito" | "nao_aceito";

export function notificarStatusTrabalho(user: User, trabalhoId: string, tipo: TipoStatusTrabalho) {
  void chamar(user, "trabalho-status", { trabalhoId, tipo });
}

export function notificarAtribuicao(
  user: User,
  destinatarios: { uid: string; papel: "avaliador" | "moderador"; quantidade: number }[],
) {
  if (destinatarios.length === 0) return;
  void chamar(user, "atribuicao", { destinatarios });
}
