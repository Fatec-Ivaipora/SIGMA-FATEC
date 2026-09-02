import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

/** Uids de quem já demonstrou interesse/está inscrito num evento (2026-08-31)
 * — usado só pra restringir a busca de colega (SubmeterTrabalhoModal) a quem
 * já apareceu nesse evento. Precisa de rota própria (Admin SDK) porque as
 * Firestore Security Rules só deixam um aluno comum ler a PRÓPRIA inscrição
 * (inscricoesEvento/{eventoId}::{uid}) — listar a coleção inteira filtrando
 * só por eventoId (sem uid) é negado pra quem não é admin/organização.
 * Retorna só os uids, nunca nome/email/status — isso continua restrito. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  try {
    await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  }

  const url = new URL(request.url);
  const eventoId = url.searchParams.get("eventoId");
  if (!eventoId) {
    return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
  }

  const snap = await getAdminDb()
    .collection("inscricoesEvento")
    .where("eventoId", "==", eventoId)
    .get();

  return NextResponse.json({ uids: snap.docs.map((d) => d.data().uid as string) });
}
