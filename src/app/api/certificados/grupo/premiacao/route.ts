import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { CertificadoGrupoPremiacaoPDF } from "@/lib/certificadosPdf";
import { ASSINANTES_CERTIFICADO, type AssinanteCertificado } from "@/lib/assinantesCertificado";
import { analisarEmpatesPorArea, STATUS_JA_AVALIADO } from "@/lib/analiseEmpate";
import { tituloExibicao } from "@/lib/tituloTrabalho";
import type { Trabalho } from "@/lib/data/trabalhos";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Certificado de PREMIAÇÃO em grupo, pro mural público (2026-11-13) — ver
 * GET /api/certificados/grupo/busca (lista) e CertificadoGrupoPremiacaoPDF
 * (template, diferente do de apresentação — pedido explícito do usuário).
 * Público igual a .../apresentacao; exige além do trabalho "aceito", que
 * `premiado === true`. A posição (1º/2º/3º) reaproveita
 * analisarEmpatesPorArea, a MESMA fonte de sempre — nunca recalculada
 * diferente aqui. Sem número de registro, mesmo motivo do de
 * apresentação. */
export async function GET(request: Request) {
  try {
    const db = getAdminDb();
    const url = new URL(request.url);
    const trabalhoId = url.searchParams.get("trabalhoId");
    if (!trabalhoId) {
      return NextResponse.json({ erro: "trabalhoId é obrigatório." }, { status: 400 });
    }

    const trabalhoSnap = await db.doc(`trabalhos/${trabalhoId}`).get();
    const trabalho = trabalhoSnap.data();
    if (!trabalho) {
      return NextResponse.json({ erro: "Trabalho não encontrado." }, { status: 404 });
    }
    if (trabalho.status !== "aceito" || trabalho.premiado !== true) {
      return NextResponse.json({ erro: "Esse trabalho não é premiado." }, { status: 400 });
    }

    const eventoSnap = await db.doc(`eventos/${trabalho.eventoId}`).get();
    const evento = eventoSnap.data();
    if (!evento || evento.certificadosGrupoPublicosAtivo !== true) {
      return NextResponse.json({ erro: "Essa consulta não está disponível no momento." }, { status: 403 });
    }
    if (!evento.dataRealizacao) {
      return NextResponse.json({ erro: "Evento sem data de realização configurada." }, { status: 400 });
    }
    const assinantes: AssinanteCertificado[] = ((evento.assinantesCertificadoIds as string[] | undefined) ?? [])
      .map((id) => ASSINANTES_CERTIFICADO.find((a) => a.id === id))
      .filter((a): a is AssinanteCertificado => !!a);
    if (assinantes.length === 0) {
      return NextResponse.json({ erro: "Evento sem assinantes configurados." }, { status: 400 });
    }

    const trabalhosSnap = await db
      .collection("trabalhos")
      .where("eventoId", "==", trabalho.eventoId)
      .get();
    const trabalhos = trabalhosSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trabalho);
    const pool = trabalhos.filter(
      (t) =>
        STATUS_JA_AVALIADO.includes(t.status) &&
        typeof t.notaAvaliador === "number" &&
        t.compareceuApresentacao !== false,
    );
    let posicao: number | undefined;
    for (const [, info] of analisarEmpatesPorArea(pool)) {
      if (info.posicoes[trabalhoId] !== undefined) {
        posicao = info.posicoes[trabalhoId];
        break;
      }
    }
    if (!posicao) {
      return NextResponse.json({ erro: "Posição ainda não resolvida pra esse trabalho." }, { status: 400 });
    }

    const nomes = [trabalho.alunoNome as string, ...((trabalho.participantesNomes ?? []) as string[])];
    if (trabalho.nomeOrientador) nomes.push(trabalho.nomeOrientador as string);
    nomes.push(...((trabalho.nomesCoorientadores ?? []) as string[]));

    const buffer = await renderToBuffer(
      CertificadoGrupoPremiacaoPDF({
        nomes,
        eventoNome: evento.nome as string,
        dataRealizacao: evento.dataRealizacao as string,
        tituloTrabalho: tituloExibicao(trabalho.titulo as string),
        areaTematica: trabalho.areaTematica as string,
        posicao,
        assinantes,
      }),
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="premiacao-${slug(trabalho.titulo as string)}.pdf"`,
      },
    });
  } catch (e) {
    console.error("Erro ao gerar certificado de premiação em grupo:", e);
    return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
  }
}
