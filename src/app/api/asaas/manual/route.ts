import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";
import { registrarAtividade } from "@/lib/atividadesAdmin";

/** Inscrição extra (2026-08-26) — organização/admin marcam manualmente um
 * aluno como pago, pra casos de pagamento feito por fora do sistema
 * (dinheiro em mãos, etc). O aluno precisa já ter conta cadastrada. */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  let chamadorUid: string;
  try {
    chamadorUid = (await getAdminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  }

  const db = getAdminDb();
  const chamadorDoc = await db.doc(`usuarios/${chamadorUid}`).get();
  const chamador = chamadorDoc.data();

  const { eventoId, alunoUid } = (await request.json()) as {
    eventoId?: string;
    alunoUid?: string;
  };
  if (!eventoId || !alunoUid) {
    return NextResponse.json({ erro: "eventoId e alunoUid são obrigatórios." }, { status: 400 });
  }

  const souAdmin = chamador?.papel === "admin";
  const souOrganizacaoDoEvento =
    chamador?.papel === "organizacao" &&
    (chamador?.eventosPermitidos as string[] | undefined)?.includes(eventoId);
  if (!souAdmin && !souOrganizacaoDoEvento) {
    return NextResponse.json(
      { erro: "Sem permissão para inscrever alguém neste evento." },
      { status: 403 },
    );
  }

  const eventoSnap = await db.doc(`eventos/${eventoId}`).get();
  const evento = eventoSnap.data();
  const valorInscricao = evento?.valorInscricao as number | undefined;
  if (!evento || !valorInscricao || valorInscricao <= 0) {
    return NextResponse.json(
      { erro: "Este evento não tem taxa de inscrição." },
      { status: 400 },
    );
  }

  const alunoSnap = await db.doc(`usuarios/${alunoUid}`).get();
  const aluno = alunoSnap.data();
  if (!aluno || aluno.papel !== "aluno") {
    return NextResponse.json({ erro: "Aluno não encontrado." }, { status: 404 });
  }

  await db.doc(`inscricoesEvento/${eventoId}::${alunoUid}`).set(
    {
      eventoId,
      uid: alunoUid,
      nome: aluno.nome,
      email: aluno.email,
      vinculoFatec: aluno.vinculoFatec ?? true,
      valor: valorInscricao,
      status: "pago",
      asaasPaymentId: "MANUAL",
      criadoEm: FieldValue.serverTimestamp(),
      pagoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // Feed da tela inicial (2026-09-09) — melhor esforço, nunca derruba o
  // e-mail abaixo se falhar.
  try {
    await registrarAtividade({
      uid: alunoUid,
      tipo: "pagamento",
      texto: `Seu pagamento foi confirmado para o evento ${evento.nome}.`,
      negritos: [evento.nome],
      eventoId,
    });
  } catch {
    // idem
  }

  if (aluno.email) {
    await enviarEmail({
      to: aluno.email,
      subject: `Pagamento confirmado — ${evento.nome}`,
      html: modeloEmail(
        `<p>Recebemos a confirmação do seu pagamento pra <strong>${evento.nome}</strong>.</p>
         <p>Sua inscrição está completa.</p>`,
        { texto: "Ver no SIGMA", href: `${URL_SISTEMA}/aluno/eventos` },
        aluno.nome,
      ),
    });
  }

  return NextResponse.json({ ok: true });
}
