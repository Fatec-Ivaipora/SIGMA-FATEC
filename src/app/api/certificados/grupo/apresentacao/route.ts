import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { CertificadoGrupoApresentacaoPDF } from "@/lib/certificadosPdf";
import { ASSINANTES_CERTIFICADO, type AssinanteCertificado } from "@/lib/assinantesCertificado";
import { tituloExibicao } from "@/lib/tituloTrabalho";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Certificado de apresentação em grupo, pro mural público (2026-11-13) —
 * ver GET /api/certificados/grupo/busca (lista) e
 * CertificadoGrupoApresentacaoPDF (template). Público de propósito (igual
 * /api/ensalamento/consulta): só exige
 * `eventos/{id}.certificadosGrupoPublicosAtivo === true` e o trabalho estar
 * "aceito" — nenhuma conta, nenhum login. Sem número de registro (ainda não
 * definido com a comissão, ver comentário no componente). */
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
    if (trabalho.status !== "aceito") {
      return NextResponse.json({ erro: "Esse trabalho ainda não está disponível." }, { status: 400 });
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

    const nomes = [trabalho.alunoNome as string, ...((trabalho.participantesNomes ?? []) as string[])];
    if (trabalho.nomeOrientador) nomes.push(trabalho.nomeOrientador as string);
    nomes.push(...((trabalho.nomesCoorientadores ?? []) as string[]));

    const buffer = await renderToBuffer(
      CertificadoGrupoApresentacaoPDF({
        nomes,
        eventoNome: evento.nome as string,
        dataRealizacao: evento.dataRealizacao as string,
        tituloTrabalho: tituloExibicao(trabalho.titulo as string),
        assinantes,
      }),
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="apresentacao-${slug(trabalho.titulo as string)}.pdf"`,
      },
    });
  } catch (e) {
    console.error("Erro ao gerar certificado de apresentação em grupo:", e);
    return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
  }
}
