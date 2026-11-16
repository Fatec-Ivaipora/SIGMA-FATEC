import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { CertificadoBancaTCCPDF } from "@/lib/certificadosPdf";
import { ASSINANTES_CERTIFICADO, type AssinanteCertificado } from "@/lib/assinantesCertificado";
import { tituloExibicao } from "@/lib/tituloTrabalho";
import { idFirestoreValido } from "@/lib/idPublico";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Certificado de banca de TCC (2026-11-16) — qualquer um dos envolvidos
 * pode baixar: o próprio aluno, o orientador, qualquer um dos 2
 * avaliadores da banca, ou admin/organização do evento. Exige a banca
 * completa (2 avaliadores definidos) — sem isso não tem o que imprimir nos
 * "3 membros". Diferente de /api/certificados/grupo/apresentacao (MAC):
 * essa rota é autenticada, não pública — TCC ainda não tem um mural
 * público equivalente a certificadosGrupoPublicosAtivo. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const trabalhoId = new URL(request.url).searchParams.get("trabalhoId");
    if (!idFirestoreValido(trabalhoId)) {
      return NextResponse.json({ erro: "trabalhoId é obrigatório." }, { status: 400 });
    }

    const trabalhoSnap = await db.doc(`trabalhos/${trabalhoId}`).get();
    const trabalho = trabalhoSnap.data();
    if (!trabalho) {
      return NextResponse.json({ erro: "Trabalho não encontrado." }, { status: 404 });
    }

    const bancaAvaliadoresUids = (trabalho.bancaAvaliadoresUids as string[] | undefined) ?? [];
    const chamadorSnap = await db.doc(`usuarios/${uid}`).get();
    const chamador = chamadorSnap.data();
    const autorizado =
      trabalho.alunoUid === uid ||
      trabalho.orientadorUid === uid ||
      bancaAvaliadoresUids.includes(uid) ||
      chamador?.papel === "admin" ||
      (chamador?.papel === "organizacao" &&
        !!(chamador?.eventosPermitidos as string[] | undefined)?.includes(trabalho.eventoId));
    if (!autorizado) {
      return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    }

    const bancaAvaliadores = (trabalho.bancaAvaliadores as { uid: string; nome: string }[] | undefined) ?? [];
    if (bancaAvaliadores.length < 2 || !trabalho.nomeOrientador) {
      return NextResponse.json({ erro: "A banca desse trabalho ainda não está completa." }, { status: 400 });
    }

    const eventoSnap = await db.doc(`eventos/${trabalho.eventoId}`).get();
    const evento = eventoSnap.data();
    if (!evento) {
      return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
    }
    const assinantes: AssinanteCertificado[] = ((evento.assinantesCertificadoIds as string[] | undefined) ?? [])
      .map((id) => ASSINANTES_CERTIFICADO.find((a) => a.id === id))
      .filter((a): a is AssinanteCertificado => !!a);
    if (assinantes.length === 0) {
      return NextResponse.json({ erro: "Evento sem assinantes configurados." }, { status: 400 });
    }
    if (!evento.cursoRestrito) {
      return NextResponse.json({ erro: "Evento sem curso configurado." }, { status: 400 });
    }

    const dataAssinatura = (trabalho.bancaData as string | undefined) ?? evento.dataRealizacao;
    if (!dataAssinatura) {
      return NextResponse.json({ erro: "Trabalho sem data de banca." }, { status: 400 });
    }

    const buffer = await renderToBuffer(
      CertificadoBancaTCCPDF({
        banca: [...bancaAvaliadores, { nome: trabalho.nomeOrientador as string }],
        tituloTrabalho: tituloExibicao(trabalho.titulo as string),
        alunoNomes: [trabalho.alunoNome as string],
        nomeOrientador: trabalho.nomeOrientador as string,
        curso: evento.cursoRestrito as string,
        assinantes,
        dataAssinatura,
        logoCabecalhoId: evento.logoCertificadoId as string | undefined,
      }),
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="banca-tcc-${slug(trabalho.titulo as string)}.pdf"`,
      },
    });
  } catch (e) {
    console.error("Erro ao gerar certificado de banca de TCC:", e);
    return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
  }
}
