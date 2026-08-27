import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { buscarCobranca } from "@/lib/asaas";

const STATUS_PAGO = new Set(["CONFIRMED", "RECEIVED"]);

/** Fallback de sincronização manual — usado localmente, onde não há webhook
 * público do Asaas apontando pra essa app (RF de pagamento, 2026-08-26). */
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

  const eventoId = new URL(request.url).searchParams.get("eventoId");
  if (!eventoId) {
    return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
  }

  const inscricaoRef = getAdminDb().doc(`inscricoesEvento/${eventoId}::${uid}`);
  const inscricaoSnap = await inscricaoRef.get();
  const inscricao = inscricaoSnap.data();
  if (!inscricao) {
    return NextResponse.json({ status: "inexistente" });
  }
  if (inscricao.status === "pago") {
    return NextResponse.json({ status: "pago" });
  }

  const cobranca = await buscarCobranca(inscricao.asaasPaymentId);
  if (STATUS_PAGO.has(cobranca.status)) {
    await inscricaoRef.update({ status: "pago", pagoEm: FieldValue.serverTimestamp() });
    return NextResponse.json({ status: "pago" });
  }

  return NextResponse.json({ status: "pendente" });
}
