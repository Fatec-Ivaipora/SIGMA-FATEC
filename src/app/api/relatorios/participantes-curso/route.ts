import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { RelatorioCursosPDF } from "@/lib/certificadosPdf";
import { montarRelatorioCursos, type TrabalhoParaRelatorio } from "@/lib/relatorioCursos";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** PDF do relatório de participantes por curso (2026-10-28, pedido
 * explícito do usuário — entregar aos coordenadores). `curso` vazio = todos
 * os cursos, um por página. Só admin/organização do evento (lista nominal
 * com e-mail e situação da inscrição). Mesma regra da tela ao vivo
 * (Relatórios → Participantes por curso): montarRelatorioCursos. */
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

    const [inscricoesSnap, trabalhosSnap] = await Promise.all([
      db.collection("inscricoesEvento").where("eventoId", "==", eventoId).get(),
      db.collection("trabalhos").where("eventoId", "==", eventoId).get(),
    ]);
    const inscricoes = inscricoesSnap.docs.map((d) => {
      const i = d.data();
      return { uid: i.uid as string, nome: (i.nome as string) ?? "", email: i.email as string | undefined, status: i.status as string };
    });
    const trabalhos = trabalhosSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrabalhoParaRelatorio);

    // Curso (e e-mail, se faltar na inscrição) vem do perfil — inclui os
    // autores de trabalho, que podem não ter inscrição própria.
    const uids = [
      ...new Set([
        ...inscricoes.map((i) => i.uid),
        ...trabalhos.flatMap((t) => [t.alunoUid, ...(t.participantesUids ?? [])]),
      ]),
    ].filter(Boolean);
    const perfis = uids.length ? await db.getAll(...uids.map((u) => db.doc(`usuarios/${u}`))) : [];
    const cursoPorUid: Record<string, string | undefined> = {};
    const emailPorUid: Record<string, string | undefined> = {};
    for (const p of perfis) {
      cursoPorUid[p.id] = p.data()?.curso as string | undefined;
      emailPorUid[p.id] = p.data()?.email as string | undefined;
    }
    for (const i of inscricoes) i.email = i.email || emailPorUid[i.uid];

    let cursos = montarRelatorioCursos(inscricoes, cursoPorUid, trabalhos);
    if (cursoFiltro) cursos = cursos.filter((c) => c.curso === cursoFiltro);
    if (cursos.length === 0) {
      return NextResponse.json({ erro: "Nenhum participante encontrado para esse curso." }, { status: 404 });
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
      RelatorioCursosPDF({ eventoNome: evento.nome as string, geradoEm, cursos }),
    );
    const nomeArquivo = `participantes-${cursoFiltro ? slug(cursoFiltro) : "todos-os-cursos"}-${slug(evento.nome as string)}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${nomeArquivo}"` },
    });
  } catch (e) {
    console.error("Erro ao gerar relatório por curso:", e);
    return NextResponse.json({ erro: "Erro interno ao gerar o relatório." }, { status: 500 });
  }
}
