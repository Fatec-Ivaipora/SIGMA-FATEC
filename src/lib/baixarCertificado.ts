"use client";

import type { User } from "firebase/auth";

type ChaveCertificado =
  | { papel: "aluno"; trabalhoId: string }
  // uidAlvo (2026-09-11) — só faz efeito quando quem chama é admin/organização
  // emitindo em nome de outra pessoa (tela Declarações → Emitir certificado);
  // pra auto-atendimento normal, omitir e a rota usa o próprio uid de quem
  // chama.
  | { papel: "avaliador" | "moderador" | "monitor"; eventoId: string; uidAlvo?: string }
  // Orientador nunca é auto-atendimento — é texto livre no trabalho, sem
  // conta vinculada, só admin/organização emite (ver /api/certificados).
  | { papel: "orientador"; trabalhoId: string };

/** Busca o PDF autenticado e dispara o download no navegador — usado tanto
 * pelo certificado do aluno (por trabalho) quanto pelas declarações de
 * avaliador/moderador/monitor/orientador (ver /api/certificados). */
export async function baixarCertificado(
  user: User,
  chave: ChaveCertificado,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const idToken = await user.getIdToken();
  const query =
    chave.papel === "aluno" || chave.papel === "orientador"
      ? `trabalhoId=${encodeURIComponent(chave.trabalhoId)}&papel=${chave.papel}`
      : `eventoId=${encodeURIComponent(chave.eventoId)}&papel=${chave.papel}` +
        (chave.uidAlvo ? `&uidAlvo=${encodeURIComponent(chave.uidAlvo)}` : "");

  const res = await fetch(`/api/certificados?${query}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) {
    const corpo = await res.json().catch(() => null);
    return { ok: false, erro: corpo?.erro ?? "Não foi possível gerar o certificado." };
  }

  const blob = await res.blob();
  const nomeArquivo =
    res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
    "certificado.pdf";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { ok: true };
}
