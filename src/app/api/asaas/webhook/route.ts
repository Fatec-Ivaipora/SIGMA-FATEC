import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";
import { registrarAtividade } from "@/lib/atividadesAdmin";

const STATUS_PAGO = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);

type WebhookAsaas = {
  // Id do evento em si (formato "evt_..."), distinto de payment.id — usado
  // pra idempotência abaixo. A Asaas garante entrega "at-least-once", então
  // o mesmo evento pode chegar mais de uma vez.
  id?: string;
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

  const db = getAdminDb();

  // Idempotência (2026-09-18) — a Asaas pode reenviar o mesmo evento (entrega
  // "at-least-once", e principalmente depois de reativar uma fila
  // interrompida, que reprocessa o backlog inteiro). Sem isso, um reenvio
  // duplicado manda e-mail de confirmação duplicado pro aluno.
  if (body.id) {
    const eventoProcessadoRef = db.doc(`webhookEventsProcessados/${body.id}`);
    if ((await eventoProcessadoRef.get()).exists) {
      return NextResponse.json({ ok: true, duplicado: true });
    }
  }

  const inscricaoRef = db.doc(`inscricoesEvento/${body.payment.externalReference}`);
  await inscricaoRef.set({ status: "pago", pagoEm: FieldValue.serverTimestamp() }, { merge: true });

  // Marca o evento como processado assim que a mudança que importa (status
  // do pagamento) já está gravada — dali em diante só sobra efeito colateral
  // de melhor esforço (feed, e-mail), que não deve fazer a Asaas reenviar o
  // evento inteiro de novo se falhar.
  if (body.id) {
    await db.doc(`webhookEventsProcessados/${body.id}`).set({
      event: body.event,
      externalReference: body.payment.externalReference,
      processadoEm: FieldValue.serverTimestamp(),
    });
  }

  const inscricao = (await inscricaoRef.get()).data();
  const evento = inscricao
    ? (await db.doc(`eventos/${inscricao.eventoId}`).get()).data()
    : undefined;

  if (inscricao?.uid) {
    // Feed da tela inicial (2026-09-09) — melhor esforço, nunca derruba o
    // e-mail abaixo se falhar.
    try {
      const eventoNome = evento?.nome ?? "seu evento";
      await registrarAtividade({
        uid: inscricao.uid,
        tipo: "pagamento",
        texto: `Seu pagamento foi confirmado para o evento ${eventoNome}.`,
        negritos: [eventoNome],
        eventoId: inscricao.eventoId,
      });
    } catch {
      // idem
    }
  }
  if (inscricao?.email) {
    // Melhor esforço (2026-09-18) — o pagamento já foi gravado acima; se o
    // envio de e-mail falhar ou demorar, isso não pode derrubar a resposta
    // 200 e fazer a Asaas recontar um evento que na prática já processamos
    // (foi exatamente esse acúmulo, sem tratamento, que suspeitamos ter
    // causado os timeouts que interromperam a fila).
    try {
      await enviarEmail({
        to: inscricao.email,
        subject: `Pagamento confirmado — ${evento?.nome ?? "seu evento"}`,
        html: modeloEmail(
          `<p>Recebemos a confirmação do seu pagamento pra <strong>${evento?.nome ?? "o evento"}</strong>.</p>
           <p>Sua inscrição está completa.</p>`,
          { texto: "Ver no SIGMA", href: `${URL_SISTEMA}/aluno/eventos` },
          inscricao.nome,
        ),
      });
    } catch {
      // idem
    }
  }

  return NextResponse.json({ ok: true });
}
