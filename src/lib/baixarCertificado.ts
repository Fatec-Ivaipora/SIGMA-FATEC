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
  // coorientador (2026-10-27): índice em trabalho.nomesCoorientadores — mesma
  // rota do orientador, só muda o nome e o papel na declaração.
  | { papel: "orientador"; trabalhoId: string; coorientador?: number }
  // Certificado de participação (2026-09-22) — evento "simples", sem
  // trabalho nenhum por trás, só a inscrição do próprio uid nesse evento.
  // uidAlvo (2026-10-01) — mesmo espírito do avaliador/moderador/monitor
  // acima, pra tela Declarações → "Emitir certificado" gerar o de outra
  // pessoa.
  | { papel: "participante"; eventoId: string; uidAlvo?: string };

/** Dispara o download no navegador a partir de uma resposta de PDF já
 * confirmada (2026-10-19, extraído de baixarCertificado pra reaproveitar em
 * baixarAta também) — nome do arquivo vem do Content-Disposition que o
 * servidor já manda, nunca inventado no client. */
function dispararDownload(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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
      ? `trabalhoId=${encodeURIComponent(chave.trabalhoId)}&papel=${chave.papel}` +
        (chave.papel === "orientador" && chave.coorientador !== undefined
          ? `&coorientador=${chave.coorientador}`
          : "")
      : `eventoId=${encodeURIComponent(chave.eventoId)}&papel=${chave.papel}` +
        ("uidAlvo" in chave && chave.uidAlvo
          ? `&uidAlvo=${encodeURIComponent(chave.uidAlvo)}`
          : "");

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
  dispararDownload(blob, nomeArquivo);

  return { ok: true };
}

/** Ata de Registro (2026-10-19, pedido explícito do usuário) — rota própria
 * (/api/certificados/ata), fora do leque de `papel` acima: não é documento
 * de uma pessoa, é a lista de todo mundo registrado num evento. Mesmo
 * padrão de download de `baixarCertificado`. */
export async function baixarAta(
  user: User,
  dados: { eventoId: string; numeroAta: string; ano: string; livro: string },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const idToken = await user.getIdToken();
  const query = new URLSearchParams(dados).toString();

  const res = await fetch(`/api/certificados/ata?${query}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) {
    const corpo = await res.json().catch(() => null);
    return { ok: false, erro: corpo?.erro ?? "Não foi possível gerar a ata." };
  }

  const blob = await res.blob();
  const nomeArquivo =
    res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "ata.pdf";
  dispararDownload(blob, nomeArquivo);

  return { ok: true };
}

/** Lista de presença de um período em PDF (2026-10-21, pedido explícito do
 * usuário) — ver GET /api/inscricoes/lista-presenca/pdf. Mesmo padrão de
 * download de `baixarAta`. */
export async function baixarListaPresenca(
  user: User,
  dados: { eventoId: string; periodo: number },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const idToken = await user.getIdToken();
  const query = new URLSearchParams({
    eventoId: dados.eventoId,
    periodo: String(dados.periodo),
  }).toString();

  const res = await fetch(`/api/inscricoes/lista-presenca/pdf?${query}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) {
    const corpo = await res.json().catch(() => null);
    return { ok: false, erro: corpo?.erro ?? "Não foi possível gerar a lista de presença." };
  }

  const blob = await res.blob();
  const nomeArquivo =
    res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
    "lista-presenca.pdf";
  dispararDownload(blob, nomeArquivo);

  return { ok: true };
}

/** Relatório de participantes por curso em PDF (2026-10-28) — ver GET
 * /api/relatorios/participantes-curso. Sem `curso` = todos os cursos. */
export async function baixarRelatorioCursos(
  user: User,
  dados: { eventoId: string; curso?: string },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const idToken = await user.getIdToken();
  const query = new URLSearchParams({ eventoId: dados.eventoId, ...(dados.curso ? { curso: dados.curso } : {}) });
  const res = await fetch(`/api/relatorios/participantes-curso?${query.toString()}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    const corpo = await res.json().catch(() => null);
    return { ok: false, erro: corpo?.erro ?? "Não foi possível gerar o relatório." };
  }
  const blob = await res.blob();
  const nomeArquivo =
    res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "relatorio-participantes.pdf";
  dispararDownload(blob, nomeArquivo);
  return { ok: true };
}

/** PDF da participação por turma do Edubox (um curso ou todos) — ver
 * /api/relatorios/turmas-edubox. */
export async function baixarRelatorioTurmas(
  user: User,
  dados: { eventoId: string; curso?: string },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const idToken = await user.getIdToken();
  const query = new URLSearchParams({
    eventoId: dados.eventoId,
    formato: "pdf",
    ...(dados.curso ? { curso: dados.curso } : {}),
  });
  const res = await fetch(`/api/relatorios/turmas-edubox?${query.toString()}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    const corpo = await res.json().catch(() => null);
    return { ok: false, erro: corpo?.erro ?? "Não foi possível gerar o relatório por turma." };
  }
  const blob = await res.blob();
  const nomeArquivo =
    res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "relatorio-turmas.pdf";
  dispararDownload(blob, nomeArquivo);
  return { ok: true };
}
