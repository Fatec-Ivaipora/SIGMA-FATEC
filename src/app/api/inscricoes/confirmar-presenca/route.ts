import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { codigoParaJanela, interpretarTextoQr, janelaValida } from "@/lib/qrPresenca";

/** Confirma a presença do próprio uid num evento "simples" (2026-09-23) a
 * partir do texto lido da câmera. Self-service — qualquer logado confirma a
 * PRÓPRIA presença, nunca a de outra pessoa (sem uidAlvo, diferente das
 * rotas de certificado que admin/organização podem emitir em nome de
 * alguém). inscricoesEvento é allow write: if false pro client — só esta
 * rota (Admin SDK) grava presencaConfirmada. */
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
  const { eventoId, janela, codigo } = interpretado;

  const db = getAdminDb();
  const inscricaoRef = db.doc(`inscricoesEvento/${eventoId}::${uid}`);
  const inscricao = (await inscricaoRef.get()).data();
  if (!inscricao) {
    return NextResponse.json(
      { erro: "Você não está inscrito nesse evento." },
      { status: 400 },
    );
  }
  if (inscricao.presencaConfirmada) {
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
  if (!segredo || codigoParaJanela(segredo, eventoId, janela) !== codigo) {
    return NextResponse.json(
      { erro: "Código inválido — escaneie o QR exibido pelo organizador." },
      { status: 400 },
    );
  }

  await inscricaoRef.set(
    { presencaConfirmada: true, presencaConfirmadaEm: FieldValue.serverTimestamp() },
    { merge: true },
  );

  return NextResponse.json({ ok: true, jaConfirmada: false });
}
