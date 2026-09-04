import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";

/** Simulação da Etapa 1 (pagamento) — marca a inscrição como paga sem passar
 * por nenhum gateway real. Se desliga sozinha assim que ASAAS_API_KEY existir
 * (pra nunca sobreviver acidentalmente numa cobrança de verdade), exceto pra
 * eventos marcados como permiteSimulacaoPagamento (2026-08-28) — só usado no
 * evento de demonstração, pra apresentação, onde não tem cobrança real. */
export async function POST(request: Request) {
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

  const { eventoId } = (await request.json()) as { eventoId?: string };
  if (!eventoId) {
    return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
  }

  const db = getAdminDb();
  const eventoSnap = await db.doc(`eventos/${eventoId}`).get();
  const evento = eventoSnap.data();
  const valorInscricao = evento?.valorInscricao as number | undefined;
  if (!evento || !valorInscricao || valorInscricao <= 0) {
    return NextResponse.json(
      { erro: "Este evento não tem taxa de inscrição." },
      { status: 400 },
    );
  }

  if (process.env.ASAAS_API_KEY && !evento.permiteSimulacaoPagamento) {
    return NextResponse.json(
      { erro: "Simulação desativada — o Asaas já está configurado." },
      { status: 403 },
    );
  }

  const usuarioSnap = await db.doc(`usuarios/${uid}`).get();
  const usuario = usuarioSnap.data();
  if (!usuario) {
    return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
  }

  await db.doc(`inscricoesEvento/${eventoId}::${uid}`).set(
    {
      eventoId,
      uid,
      nome: usuario.nome,
      email: usuario.email,
      vinculoFatec: usuario.vinculoFatec ?? true,
      valor: valorInscricao,
      status: "pago",
      asaasPaymentId: "SIMULADO",
      criadoEm: FieldValue.serverTimestamp(),
      pagoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  if (usuario.email) {
    await enviarEmail({
      to: usuario.email,
      subject: `Pagamento confirmado — ${evento.nome}`,
      html: modeloEmail(
        `<p>Recebemos a confirmação do seu pagamento pra <strong>${evento.nome}</strong>.</p>
         <p>Sua inscrição está completa.</p>`,
        { texto: "Ver no SIGMA", href: `${URL_SISTEMA}/aluno/eventos` },
      ),
    });
  }

  return NextResponse.json({ ok: true });
}
