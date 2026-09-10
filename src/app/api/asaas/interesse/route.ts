import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

/** "Participar" (2026-08-26): primeiro clique do aluno num evento, antes de
 * qualquer coisa envolvendo pagamento ou trabalho — só registra que ele tem
 * interesse. É esse registro que faz a trilha (ou o botão de inscrever
 * trabalho, em evento sem taxa) passar a aparecer no card. Nunca sobrescreve
 * um status mais avançado (pendente/pago) que já exista. */
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
  if (!evento) {
    return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
  }
  // Evento encerrado (2026-09-10) — não aceita inscrição nova, mesmo que
  // alguém chame essa rota direto (não só escondendo o botão no client).
  if (evento.encerrado) {
    return NextResponse.json({ erro: "Esse evento está encerrado." }, { status: 400 });
  }

  const usuarioSnap = await db.doc(`usuarios/${uid}`).get();
  const usuario = usuarioSnap.data();
  if (!usuario) {
    return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
  }

  const ref = db.doc(`inscricoesEvento/${eventoId}::${uid}`);
  const existente = (await ref.get()).data();
  if (!existente) {
    await ref.set({
      eventoId,
      uid,
      nome: usuario.nome,
      email: usuario.email,
      vinculoFatec: usuario.vinculoFatec ?? true,
      valor: evento.valorInscricao ?? 0,
      status: "interesse",
      criadoEm: FieldValue.serverTimestamp(),
    });
  }

  return NextResponse.json({ ok: true });
}
