import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { registrarAtividade } from "@/lib/atividadesAdmin";

/** Avisa o feed da tela inicial do DONO do trabalho quando um colega aceita
 * o convite de autor (2026-09-09) — único evento do feed que ainda não
 * passava por servidor nenhum (responderConvite, em src/lib/data/trabalhos.ts,
 * é uma escrita direta do client no Firestore). Chamado pelo client logo
 * depois que esse updateDoc (aceitar=true) já foi confirmado — nunca
 * escreve/edita o trabalho aqui, só registra a atividade. Quem chama tem
 * que já estar em participantesUids (prova que é um autor de verdade desse
 * trabalho, não qualquer um forjando "fulano aceitou X"). */
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

  const { trabalhoId } = (await request.json()) as { trabalhoId?: string };
  if (!trabalhoId) {
    return NextResponse.json({ erro: "trabalhoId é obrigatório." }, { status: 400 });
  }

  const db = getAdminDb();
  const trabalhoSnap = await db.doc(`trabalhos/${trabalhoId}`).get();
  const trabalho = trabalhoSnap.data();
  if (!trabalho) {
    return NextResponse.json({ erro: "Trabalho não encontrado." }, { status: 404 });
  }
  if (!((trabalho.participantesUids as string[] | undefined) ?? []).includes(chamadorUid)) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const chamadorSnap = await db.doc(`usuarios/${chamadorUid}`).get();
  const chamadorNome = (chamadorSnap.data()?.nome as string | undefined) ?? "Um colega";

  try {
    await registrarAtividade({
      uid: trabalho.alunoUid,
      tipo: "convite_aceito",
      texto: `${chamadorNome} aceitou ser autor no seu trabalho "${trabalho.titulo}".`,
      negritos: [chamadorNome, `"${trabalho.titulo}"`],
      trabalhoId,
      eventoId: trabalho.eventoId,
    });
  } catch {
    // melhor esforço — não é crítico o feed falhar aqui.
  }

  return NextResponse.json({ ok: true });
}
