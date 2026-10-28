import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { RelatorioTurmasPDF } from "@/lib/certificadosPdf";
import { montarRelatorioTurmas, type AlunoAtivoEdubox, type AlunoTurma } from "@/lib/relatorioTurmas";

/** Mesmo cálculo do relay (turmas-ativas.mjs): HMAC-SHA256 dos dígitos do
 * CPF com o token do relay como chave, 32 primeiros caracteres em hexa. */
function cpfHash(cpf: string | undefined | null, chave: string): string | null {
  const digitos = String(cpf ?? "").replace(/\D/g, "");
  return digitos ? createHmac("sha256", chave).update(digitos).digest("hex").slice(0, 32) : null;
}

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Participantes por TURMA do Edubox (2026-10-28, pedido explícito do
 * usuário — "bater com o Edubox, turmas e alunos ativos"). Junta os alunos
 * com matrícula ativa (relay /alunos-ativos-turmas, CPF só em HMAC) com as
 * inscrições e trabalhos do evento no SIGMA (CPF dos perfis, em HMAC com a
 * mesma chave). Só admin/organização do evento. `formato=pdf` gera o PDF
 * (com `curso`, só aquele curso); sem formato, devolve os dados pra tela. */

const VALIDADE_MS = 10 * 60 * 1000;
let cacheAtivos: { alunos: AlunoAtivoEdubox[]; semestres: string[]; carregadoEm: number } | null = null;

async function alunosAtivos(): Promise<{ alunos: AlunoAtivoEdubox[]; semestres: string[] } | null> {
  if (cacheAtivos && Date.now() - cacheAtivos.carregadoEm < VALIDADE_MS) return cacheAtivos;
  const relayUrl = process.env.EDUBOX_RELAY_URL;
  const relayToken = process.env.EDUBOX_RELAY_TOKEN;
  if (!relayUrl || !relayToken) return null;
  try {
    const res = await fetch(`${relayUrl}/alunos-ativos-turmas`, {
      headers: { Authorization: `Bearer ${relayToken}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return cacheAtivos;
    const corpo = (await res.json()) as { alunos?: AlunoAtivoEdubox[]; semestres?: string[] };
    cacheAtivos = { alunos: corpo.alunos ?? [], semestres: corpo.semestres ?? [], carregadoEm: Date.now() };
    return cacheAtivos;
  } catch {
    return cacheAtivos;
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  try {
    const uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
    const db = getAdminDb();
    const url = new URL(request.url);
    const eventoId = url.searchParams.get("eventoId");
    const cursoFiltro = url.searchParams.get("curso")?.trim() || null;
    const formatoPdf = url.searchParams.get("formato") === "pdf";
    if (!eventoId) {
      return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
    }

    const [chamadorSnap, eventoSnap] = await Promise.all([
      db.doc(`usuarios/${uid}`).get(),
      db.doc(`eventos/${eventoId}`).get(),
    ]);
    const chamador = chamadorSnap.data();
    const evento = eventoSnap.data();
    if (!evento) {
      return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
    }
    const ehStaff =
      chamador?.papel === "admin" ||
      (chamador?.papel === "organizacao" && (chamador?.eventosPermitidos ?? []).includes(eventoId));
    if (!ehStaff) {
      return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    }

    const relayToken = process.env.EDUBOX_RELAY_TOKEN;
    const ativos = await alunosAtivos();
    if (!ativos || !relayToken) {
      return NextResponse.json(
        { erro: "Não foi possível consultar as turmas do Edubox agora (relay fora do ar ou sem a rota)." },
        { status: 502 },
      );
    }

    const [inscricoesSnap, trabalhosSnap] = await Promise.all([
      db.collection("inscricoesEvento").where("eventoId", "==", eventoId).get(),
      db.collection("trabalhos").where("eventoId", "==", eventoId).get(),
    ]);
    const inscricaoPorUid = new Map(inscricoesSnap.docs.map((d) => [d.data().uid as string, d.data().status as string]));

    // Trabalhos de cada pessoa (dono ou coautor).
    const trabalhosPorUid = new Map<string, AlunoTurma["trabalhos"]>();
    for (const d of trabalhosSnap.docs) {
      const t = d.data();
      const membros: [string, boolean][] = [
        [t.alunoUid as string, true],
        ...((t.participantesUids ?? []) as string[]).map((u): [string, boolean] => [u, false]),
      ];
      for (const [u, principal] of membros) {
        const lista = trabalhosPorUid.get(u) ?? [];
        lista.push({ titulo: t.titulo as string, papel: principal ? "Autor principal" : "Coautor", status: t.status as string });
        trabalhosPorUid.set(u, lista);
      }
    }

    // CPF dos perfis (inscritos + autores) → mesmo HMAC do relay.
    const uids = [...new Set([...inscricaoPorUid.keys(), ...trabalhosPorUid.keys()])].filter(Boolean);
    const perfis = uids.length ? await db.getAll(...uids.map((u) => db.doc(`usuarios/${u}`))) : [];
    const sigmaPorHash = new Map<string, { inscricao?: string; trabalhos: AlunoTurma["trabalhos"] }>();
    for (const p of perfis) {
      const hash = cpfHash(p.data()?.cpf as string | undefined, relayToken);
      if (!hash) continue;
      sigmaPorHash.set(hash, { inscricao: inscricaoPorUid.get(p.id), trabalhos: trabalhosPorUid.get(p.id) ?? [] });
    }

    let cursos = montarRelatorioTurmas(ativos.alunos, sigmaPorHash);
    if (cursoFiltro) cursos = cursos.filter((c) => c.curso === cursoFiltro);

    // Inscritos no evento que não aparecem entre os alunos ativos (externos,
    // egressos, CPF diferente no cadastro) — só a contagem, pra transparência.
    const hashesAtivos = new Set(ativos.alunos.map((a) => a.cpfHash).filter(Boolean));
    const inscritosForaDoEdubox = [...sigmaPorHash.entries()].filter(
      ([h, v]) => v.inscricao && !hashesAtivos.has(h),
    ).length;

    if (!formatoPdf) {
      return NextResponse.json({ semestres: ativos.semestres, cursos, inscritosForaDoEdubox });
    }
    if (cursos.length === 0) {
      return NextResponse.json({ erro: "Curso não encontrado nas turmas ativas do Edubox." }, { status: 404 });
    }
    const geradoEm = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const buffer = await renderToBuffer(
      RelatorioTurmasPDF({ eventoNome: evento.nome as string, geradoEm, semestres: ativos.semestres, cursos }),
    );
    const nomeArquivo = `turmas-${cursoFiltro ? slug(cursoFiltro) : "todos-os-cursos"}-${slug(evento.nome as string)}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${nomeArquivo}"` },
    });
  } catch (e) {
    console.error("Erro no relatório por turma:", e);
    return NextResponse.json({ erro: "Erro interno ao montar o relatório por turma." }, { status: 500 });
  }
}
