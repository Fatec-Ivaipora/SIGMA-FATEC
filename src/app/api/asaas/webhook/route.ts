import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";

const STATUS_PAGO = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);

type WebhookAsaas = {
  event: string;
  payment?: { externalReference?: string };
};

/** Recebe notificações do Asaas (configurado no painel deles, com o mesmo
 * token em ASAAS_WEBHOOK_TOKEN). Não usa auth de usuário — a verificação é o
 * header abaixo, que só o Asaas conhece. */
export async function POST(request: Request) {
  const token = request.headers.get("asaas-access-token");
  if (!token || token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ erro: "Token inválido." }, { status: 401 });
  }

  const body = (await request.json()) as WebhookAsaas;
  if (!STATUS_PAGO.has(body.event) || !body.payment?.externalReference) {
    return NextResponse.json({ ok: true });
  }

  await getAdminDb()
    .doc(`inscricoesEvento/${body.payment.externalReference}`)
    .set({ status: "pago", pagoEm: FieldValue.serverTimestamp() }, { merge: true });

  return NextResponse.json({ ok: true });
}
