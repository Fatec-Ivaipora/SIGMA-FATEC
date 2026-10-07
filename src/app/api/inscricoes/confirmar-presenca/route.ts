import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { codigoParaJanela, interpretarTextoQr, janelaValida } from "@/lib/qrPresenca";
import { diasDoEvento } from "@/lib/certificadoDias";
import { registrarAtividade } from "@/lib/atividadesAdmin";

/** Confirma a presença do próprio uid num evento "simples" (2026-09-23) a
 * partir do texto lido da câmera. Self-service — qualquer logado confirma a
 * PRÓPRIA presença, nunca a de outra pessoa (sem uidAlvo, diferente das
 * rotas de certificado que admin/organização podem emitir em nome de
 * alguém). inscricoesEvento é allow write: if false pro client — só esta
 * rota (Admin SDK) grava presencasConfirmadas. */
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

  const body = (await request.json().catch(() => null)) as { texto?: string } | null;
  const interpretado = body?.texto ? interpretarTextoQr(body.texto) : null;
  if (!interpretado) {
    return NextResponse.json(
      { erro: "Esse QR não é válido pro SIGMA — confira se é o código certo." },
      { status: 400 },
    );
  }
  const { eventoId, dia, janela, codigo } = interpretado;

  const db = getAdminDb();
  const inscricaoRef = db.doc(`inscricoesEvento/${eventoId}::${uid}`);
  const inscricao = (await inscricaoRef.get()).data();
  if (!inscricao) {
    return NextResponse.json(
      { erro: "Você não está inscrito nesse evento." },
      { status: 400 },
    );
  }
  const chaveDia = String(dia);
  if (inscricao.presencasConfirmadas?.[chaveDia]) {
    return NextResponse.json({ ok: true, jaConfirmada: true });
  }

  if (!janelaValida(janela)) {
    return NextResponse.json(
      {
        erro:
          "Esse código já expirou — peça pro organizador atualizar a tela e escaneie de novo.",
      },
      { status: 400 },
    );
  }

  const segredo = (await db.doc(`eventosQr/${eventoId}`).get()).data()?.secret as
    | string
    | undefined;
  if (!segredo || codigoParaJanela(segredo, eventoId, dia, janela) !== codigo) {
    return NextResponse.json(
      { erro: "Código inválido — escaneie o QR exibido pelo organizador." },
      { status: 400 },
    );
  }

  // Dot-notation (2026-09-30) — update() em vez de set({merge:true}) pra
  // gravar só a chave desse dia dentro do mapa, sem arriscar sobrescrever as
  // confirmações de outros dias já gravadas ali.
  await inscricaoRef.update({
    [`presencasConfirmadas.${chaveDia}`]: FieldValue.serverTimestamp(),
  });

  // Feed "Atividade recente" (2026-10-07, achado real: aluno confirmava
  // presença e não aparecia nada lá — único gatilho que nunca tinha sido
  // ligado). Melhor esforço, igual todo outro trigger de atividade — nunca
  // derruba a confirmação em si, que já aconteceu acima.
  try {
    const evento = (await db.doc(`eventos/${eventoId}`).get()).data();
    const nomeEvento = (evento?.nome as string | undefined) ?? "um evento";
    const multiDia = evento && diasDoEvento(evento) > 1;
    await registrarAtividade({
      uid,
      tipo: "presenca",
      texto: multiDia
        ? `Você confirmou presença no dia ${dia} de ${nomeEvento}.`
        : `Você confirmou presença em ${nomeEvento}.`,
      negritos: [nomeEvento],
      eventoId,
    });
  } catch {
    // melhor esforço
  }

  return NextResponse.json({ ok: true, jaConfirmada: false });
}
