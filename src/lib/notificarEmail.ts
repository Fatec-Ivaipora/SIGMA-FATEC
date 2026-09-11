"use client";

import type { User } from "firebase/auth";

// Chamadas "melhor esforço" pras rotas /api/mail/* (2026-09-04) — nunca
// bloqueiam nem quebram a ação principal (submeter trabalho, dar nota,
// etc.) se o envio de e-mail falhar por qualquer motivo; por isso não são
// awaited pelos call sites e engolem o próprio erro.

async function chamar(user: User, rota: string, corpo: unknown) {
  try {
    const idToken = await user.getIdToken();
    await fetch(rota, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
  } catch {
    // melhor esforço — falha de e-mail nunca deve quebrar o fluxo principal
  }
}

export function notificarConviteColega(user: User, trabalhoId: string, colegaUid: string) {
  void chamar(user, "/api/mail/convite-colega", { trabalhoId, colegaUid });
}

export function notificarConviteTurma(user: User, turmaId: string, alunoUid: string) {
  void chamar(user, "/api/mail/convite-turma", { turmaId, alunoUid });
}

export type TipoStatusTrabalho = "submetido" | "revisao" | "avaliado" | "aceito" | "nao_aceito";

export function notificarStatusTrabalho(user: User, trabalhoId: string, tipo: TipoStatusTrabalho) {
  void chamar(user, "/api/mail/trabalho-status", { trabalhoId, tipo });
}

export function notificarAtribuicao(
  user: User,
  destinatarios: { uid: string; papel: "avaliador" | "moderador"; quantidade: number }[],
  // Só quando todos os trabalhos distribuídos são do mesmo evento (2026-09-09,
  // pra frase do feed poder citar o nome do evento) — null/ausente quando a
  // seleção espalha por mais de um, a rota cai num texto genérico.
  eventoId?: string | null,
) {
  if (destinatarios.length === 0) return;
  void chamar(user, "/api/mail/atribuicao", { destinatarios, eventoId });
}

// Feed da tela inicial (2026-09-09) — não é rota de e-mail, mas reaproveita
// o mesmo "chamar" (melhor esforço, nunca quebra o fluxo principal).
export function notificarConviteAceito(user: User, trabalhoId: string) {
  void chamar(user, "/api/trabalhos/convite-aceito", { trabalhoId });
}

// Avisa quem já tem conta que ganhou mais um papel de avaliação (2026-09-11)
// — ex.: já era avaliador, o admin marcou o checkbox "também atua como
// moderador". Chamado só na hora de ADICIONAR um papel (não ao desmarcar) —
// ver o onChange do checkbox em src/app/usuarios/page.tsx. A conta nova
// (criada do zero) já recebe esse aviso embutido na criação, direto em
// /api/usuarios — essa rota aqui é só pra quem já existia.
export function notificarNovoPapel(user: User, uid: string, papel: "avaliador" | "orientador" | "moderador") {
  void chamar(user, "/api/mail/novo-papel", { uid, papel });
}

// Alerta de segurança (2026-09-11): avisa TODOS os autores (feed + e-mail)
// quando um admin edita o trabalho deles por fora do fluxo normal — nunca
// silencioso, mesmo que o admin esteja agindo de boa-fé. Ver
// /api/trabalhos/alterado-admin.
export function notificarAlteracaoAdmin(user: User, trabalhoId: string, destinatariosUids: string[]) {
  void chamar(user, "/api/trabalhos/alterado-admin", { trabalhoId, destinatariosUids });
}
