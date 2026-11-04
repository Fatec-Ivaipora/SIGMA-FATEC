import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { EtiquetasPastasPDF } from "@/lib/etiquetasPdf";
import { tituloExibicao } from "@/lib/tituloTrabalho";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Etiquetas das pastas (2026-11-04, pedido explícito do usuário): uma por
 * trabalho, com o autor principal, título e área — folha de etiquetas Carta, 20
 * por folha (ver EtiquetasPastasPDF). Mesmos trabalhos da impressão dos certificados: todos
 * os que já foram pra avaliação (só fica de fora a Submissão); `ids` limita aos
 * marcados na tabela. Ordem alfabética do autor, pra achar a pasta fácil. Só
 * admin/organização do evento. */
const FORA = ["submissao"];

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

    const docs = ids.length
      ? await db.getAll(...ids.map((id) => db.doc(`trabalhos/${id}`)))
      : (await db.collection("trabalhos").where("eventoId", "==", eventoId).get()).docs;
    const etiquetas = docs
      .filter((d) => d.exists)
      .map((d) => d.data() as FirebaseFirestore.DocumentData)
      .filter((t) => t.eventoId === eventoId && !FORA.includes(t.status as string))
      .map((t) => ({
        autor: String(t.alunoNome ?? ""),
        titulo: tituloExibicao(String(t.titulo ?? "")),
        area: String(t.areaTematica ?? ""),
      }))
      .sort((a, b) => a.autor.localeCompare(b.autor, "pt-BR"));
    if (etiquetas.length === 0) {
      return NextResponse.json(
        { erro: "Nenhum trabalho enviado para avaliação nesse evento ainda (os que estão em Submissão não entram)." },
        { status: 404 },
      );
    }

    const buffer = await renderToBuffer(EtiquetasPastasPDF({ eventoNome: evento.nome as string, etiquetas }));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="etiquetas-pastas-${slug(evento.nome as string)}.pdf"`,
      },
    });
  } catch (e) {
    console.error("Erro ao gerar etiquetas:", e);
    return NextResponse.json({ erro: "Erro interno ao gerar as etiquetas." }, { status: 500 });
  }
}
