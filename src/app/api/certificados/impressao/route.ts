import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import {
  CertificadosApresentacaoImpressaoPDF,
  type DadosCertificadoApresentacao,
} from "@/lib/certificadosPdf";
import { ASSINANTES_CERTIFICADO, type AssinanteCertificado } from "@/lib/assinantesCertificado";
import { obterNumerosRegistroEmLote } from "@/lib/registroCertificados";
import { tituloExibicao } from "@/lib/tituloTrabalho";

// Centenas de certificados num PDF só: dá folga além do padrão da Vercel.
export const maxDuration = 60;

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
 * Só admin/organização do evento. A secretaria imprime ANTES do evento e
 * entrega no dia (2026-11-04, pedido explícito do usuário — "só conseguia
 * imprimir depois de apresentado"), então entram TODOS os trabalhos que já
 * foram pra avaliação — "não é pra deixar nenhum de fora, todos que foram pra
 * avaliação vão apresentar". Só fica de fora o que ainda está em submissão.
 * `ids` (separados por vírgula) limita aos trabalhos marcados na tabela.
 * Quem ainda não tinha número recebe agora, na ordem do título — mesma
 * sequência da Ata (obterNumeroRegistro) e mesmo número que o aluno vê depois
 * no certificado digital. */
const FORA_DA_IMPRESSAO = ["submissao"];
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
    const ids = (url.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
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
      ids.length
        ? await db.getAll(...ids.map((id) => db.doc(`trabalhos/${id}`)))
        : (await db.collection("trabalhos").where("eventoId", "==", eventoId).get()).docs
    )
      .filter((d) => d.exists)
      .map((d): FirebaseFirestore.DocumentData & { id: string } => ({ id: d.id, ...d.data() }))
      .filter((t) => t.eventoId === eventoId && !FORA_DA_IMPRESSAO.includes(t.status as string))
      .sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), "pt-BR"));
    if (trabalhos.length === 0) {
      return NextResponse.json(
        { erro: "Nenhum trabalho enviado para avaliação nesse evento ainda (os que estão em Submissão não entram)." },
        { status: 404 },
      );
    }

    // Números em lote (uma leitura + poucas transações), não um por um.
    const numeros = await obterNumerosRegistroEmLote(
      trabalhos.map((t) => ({ chave: `${t.id}_aluno`, nome: t.alunoNome as string })),
      eventoId,
      (evento.numeroRegistroInicial as number | undefined) ?? 1,
    );
    const certificados: DadosCertificadoApresentacao[] = [];
    for (const t of trabalhos) {
      const numero = numeros.get(`${t.id}_aluno`)!;
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
    const nomeArquivo = trabalhos.length === 1
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
