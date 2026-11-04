import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import {
  CertificadosApresentacaoImpressaoPDF,
  type DadosCertificadoApresentacao,
} from "@/lib/certificadosPdf";
import { ASSINANTES_CERTIFICADO, type AssinanteCertificado } from "@/lib/assinantesCertificado";
import { obterNumeroRegistro } from "@/lib/registroCertificados";
import { tituloExibicao } from "@/lib/tituloTrabalho";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Certificados de apresentação pra imprimir no PAPEL TIMBRADO (2026-11-04,
 * pedido explícito do usuário — "liberar pra secretaria gerar"): um PDF com
 * uma página por trabalho, sem o fundo (o papel já vem impresso), mesmo texto
 * e mesma numeração do certificado digital (GET /api/certificados?papel=aluno).
 * Só admin/organização do evento. Entram os trabalhos aceitos e com o
 * certificado já liberado (Resultado Final); `trabalhoId` limita a um só.
 * Quem ainda não tinha número recebe agora, na ordem do título — mesma
 * sequência da Ata (obterNumeroRegistro). */
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
    const trabalhoId = url.searchParams.get("trabalhoId");
    if (!eventoId) {
      return NextResponse.json({ erro: "Escolha o evento." }, { status: 400 });
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

    const assinantes = ((evento.assinantesCertificadoIds as string[] | undefined) ?? [])
      .map((id) => ASSINANTES_CERTIFICADO.find((a) => a.id === id))
      .filter((a): a is AssinanteCertificado => !!a);
    if (!evento.dataRealizacao || assinantes.length === 0) {
      return NextResponse.json(
        { erro: "O evento ainda não tem a data de realização ou quem assina o certificado configurados (Eventos → Certificado)." },
        { status: 400 },
      );
    }

    const trabalhos = (
      trabalhoId
        ? [await db.doc(`trabalhos/${trabalhoId}`).get()]
        : (await db.collection("trabalhos").where("eventoId", "==", eventoId).get()).docs
    )
      .filter((d) => d.exists)
      .map((d): FirebaseFirestore.DocumentData & { id: string } => ({ id: d.id, ...d.data() }))
      .filter((t) => t.eventoId === eventoId && t.status === "aceito" && t.certificadoLiberado === true)
      .sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), "pt-BR"));
    if (trabalhos.length === 0) {
      return NextResponse.json(
        { erro: "Nenhum trabalho aceito com o certificado já liberado nesse evento (libere em Resultado Final)." },
        { status: 404 },
      );
    }

    const certificados: DadosCertificadoApresentacao[] = [];
    for (const t of trabalhos) {
      const numero = await obterNumeroRegistro(
        `${t.id}_aluno`,
        eventoId,
        (evento.numeroRegistroInicial as number | undefined) ?? 1,
        t.alunoNome as string,
      );
      const nomes = [t.alunoNome as string, ...((t.participantesNomes ?? []) as string[])];
      if (t.nomeOrientador) nomes.push(t.nomeOrientador as string);
      nomes.push(...((t.nomesCoorientadores ?? []) as string[]));
      certificados.push({
        nomes,
        eventoNome: evento.nome as string,
        dataRealizacao: evento.dataRealizacao as string,
        tituloTrabalho: tituloExibicao(t.titulo as string),
        registroNumero: numero,
        assinantes,
        premiado: t.premiado === true,
      });
    }

    const buffer = await renderToBuffer(CertificadosApresentacaoImpressaoPDF({ certificados }));
    const nomeArquivo = trabalhoId
      ? `impressao-certificado-${slug(String(trabalhos[0].alunoNome))}.pdf`
      : `impressao-certificados-${slug(evento.nome as string)}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      },
    });
  } catch (e) {
    console.error("Erro ao gerar certificados pra impressão:", e);
    return NextResponse.json({ erro: "Erro interno ao gerar os certificados." }, { status: 500 });
  }
}
