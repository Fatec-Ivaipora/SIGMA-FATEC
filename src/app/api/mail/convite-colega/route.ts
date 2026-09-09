import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";

/** E-mail de convite pro colega adicionado num trabalho (RF-52) — chamado
 * pelo client logo depois do addDoc/updateDoc que cria o convite de
 * verdade (esta rota não cria nada, só notifica; a fonte da verdade
 * continua sendo o próprio doc de trabalhos). Só o dono do trabalho pode
 * disparar, e o e-mail do colega é sempre buscado no Firestore — nunca
 * aceito vindo do client. */
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

  const { trabalhoId, colegaUid } = (await request.json()) as {
    trabalhoId?: string;
    colegaUid?: string;
  };
  if (!trabalhoId || !colegaUid) {
    return NextResponse.json({ erro: "trabalhoId e colegaUid são obrigatórios." }, { status: 400 });
  }

  const db = getAdminDb();
  const trabalhoSnap = await db.doc(`trabalhos/${trabalhoId}`).get();
  const trabalho = trabalhoSnap.data();
  if (!trabalho) {
    return NextResponse.json({ erro: "Trabalho não encontrado." }, { status: 404 });
  }
  if (trabalho.alunoUid !== chamadorUid) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const colegaSnap = await db.doc(`usuarios/${colegaUid}`).get();
  const colega = colegaSnap.data();
  if (!colega?.email) {
    return NextResponse.json({ ok: true });
  }

  await enviarEmail({
    to: colega.email,
    subject: `Você foi adicionado(a) num trabalho — ${trabalho.titulo}`,
    html: modeloEmail(
      `<p><strong>${trabalho.alunoNome}</strong> te adicionou como autor no trabalho <strong>"${trabalho.titulo}"</strong>.</p>
       <p>Entre no SIGMA pra aceitar ou recusar o convite.</p>`,
      { texto: "Ver convite", href: `${URL_SISTEMA}/aluno` },
      colega.nome,
    ),
  });

  return NextResponse.json({ ok: true });
}
