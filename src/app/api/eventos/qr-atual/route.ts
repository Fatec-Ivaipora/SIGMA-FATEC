import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { janelaAtual, codigoParaJanela, gerarSegredo, montarTextoQr } from "@/lib/qrPresenca";

/** Código atual do QR de confirmação de presença de um evento "simples"
 * (2026-09-23) — só admin/organização do evento. Cria o segredo desse
 * evento na primeira chamada (lazy, ver firestore.rules `eventosQr`); nunca
 * devolve o segredo em si, só o texto do QR já calculado pra janela atual. */
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

  const url = new URL(request.url);
  const eventoId = url.searchParams.get("eventoId");
  if (!eventoId) {
    return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
  }

  const db = getAdminDb();
  const chamadorSnap = await db.doc(`usuarios/${uid}`).get();
  const chamador = chamadorSnap.data();
  const ehStaff =
    chamador?.papel === "admin" ||
    (chamador?.papel === "organizacao" &&
      (chamador?.eventosPermitidos ?? []).includes(eventoId));
  if (!ehStaff) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const eventoSnap = await db.doc(`eventos/${eventoId}`).get();
  const evento = eventoSnap.data();
  if (!evento) {
    return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
  }
  if (evento.tipo !== "simples") {
    return NextResponse.json(
      { erro: "Esse evento não usa confirmação de presença por QR." },
      { status: 400 },
    );
  }

  const segredoRef = db.doc(`eventosQr/${eventoId}`);
  let segredo = (await segredoRef.get()).data()?.secret as string | undefined;
  if (!segredo) {
    segredo = gerarSegredo();
    await segredoRef.set({ secret: segredo, criadoEm: FieldValue.serverTimestamp() });
  }

  const janela = janelaAtual();
  const codigo = codigoParaJanela(segredo, eventoId, janela);
  return NextResponse.json({
    texto: montarTextoQr(eventoId, janela, codigo),
    // duraçãoMs da janela (2026-09-23) — o client usa isso só pra saber de
    // quanto em quanto tempo pedir um código novo, não afeta a validação.
    expiraEmMs: 60_000,
  });
}
