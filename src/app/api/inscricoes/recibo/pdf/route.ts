import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { ReciboPagamentoPDF } from "@/lib/certificadosPdf";
import { formatarCPF } from "@/lib/cpf";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Recibo de pagamento em PDF (2026-11-11, pedido explícito do usuário — ver
 * ReciboPagamentoPDF em src/lib/certificadosPdf.tsx). Funciona pra qualquer
 * inscrição com status "pago" (manual ou via Asaas), mas o botão hoje só
 * aparece na Inscrição extra, que é o caso de uso real (quem pagou pelo
 * Asaas já tem o próprio comprovante do Asaas). */
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
    const alunoUid = url.searchParams.get("alunoUid");
    if (!eventoId || !alunoUid) {
      return NextResponse.json({ erro: "eventoId e alunoUid são obrigatórios." }, { status: 400 });
    }

    const [chamadorSnap, eventoSnap, inscricaoSnap, alunoSnap] = await Promise.all([
      db.doc(`usuarios/${uid}`).get(),
      db.doc(`eventos/${eventoId}`).get(),
      db.doc(`inscricoesEvento/${eventoId}::${alunoUid}`).get(),
      db.doc(`usuarios/${alunoUid}`).get(),
    ]);
    const chamador = chamadorSnap.data();
    const evento = eventoSnap.data();
    const inscricao = inscricaoSnap.data();
    const aluno = alunoSnap.data();
    if (!evento) {
      return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
    }
    const ehStaff =
      chamador?.papel === "admin" ||
      (chamador?.papel === "organizacao" && (chamador?.eventosPermitidos ?? []).includes(eventoId));
    if (!ehStaff) {
      return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    }
    if (!inscricao || inscricao.status !== "pago") {
      return NextResponse.json({ erro: "Essa inscrição não está paga." }, { status: 400 });
    }

    const pagoEm = inscricao.pagoEm;
    const dataPagamento: Date =
      typeof pagoEm?.toDate === "function" ? pagoEm.toDate() : new Date();

    const cpf = aluno?.cpf as string | undefined;

    const buffer = await renderToBuffer(
      ReciboPagamentoPDF({
        alunoNome: (inscricao.nome as string) ?? "",
        eventoNome: evento.nome as string,
        cpf: cpf ? formatarCPF(cpf) : undefined,
        valor: (inscricao.valor as number) ?? 0,
        dataPagamento,
      }),
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="recibo-${slug((inscricao.nome as string) ?? "")}-${slug(evento.nome as string)}.pdf"`,
      },
    });
  } catch (e) {
    console.error("Erro ao gerar recibo de pagamento:", e);
    return NextResponse.json({ erro: "Erro interno ao gerar o recibo." }, { status: 500 });
  }
}
