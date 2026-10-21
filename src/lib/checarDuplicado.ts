"use client";

import type { User } from "firebase/auth";

/** Pergunta ao servidor se essa submissão duplica um trabalho que já existe
 * no evento (2026-10-21 — ver /api/trabalhos/checar-duplicado). Devolve a
 * mensagem pra mostrar ao aluno, ou null se pode enviar. Ao contrário das
 * chamadas de src/lib/notificarEmail.ts, essa BLOQUEIA o envio — se a
 * checagem em si falhar (rede, servidor), também bloqueia com uma mensagem
 * de tentar de novo, em vez de deixar passar um possível duplicado. */
export async function checarTrabalhoDuplicado(
  user: User,
  dados: { eventoId: string; titulo: string; participantesUids: string[] },
): Promise<string | null> {
  try {
    const idToken = await user.getIdToken();
    const resposta = await fetch("/api/trabalhos/checar-duplicado", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    if (!resposta.ok) throw new Error(String(resposta.status));
    const corpo = (await resposta.json()) as { duplicado: boolean; mensagem?: string };
    return corpo.duplicado ? (corpo.mensagem ?? "Esse trabalho já foi enviado.") : null;
  } catch {
    return "Não foi possível conferir se esse trabalho já foi enviado. Tente de novo em instantes.";
  }
}
