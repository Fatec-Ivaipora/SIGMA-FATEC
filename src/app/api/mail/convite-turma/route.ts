import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";

/** E-mail de convite pra turma do Projeto Integrador — chamado pelo client
 * logo depois de convidarAlunoTurma (mesmo padrão de /api/mail/convite-colega).
 * Só o orientador da turma pode disparar. */
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

  const { turmaId, alunoUid } = (await request.json()) as {
    turmaId?: string;
    alunoUid?: string;
  };
  if (!turmaId || !alunoUid) {
    return NextResponse.json({ erro: "turmaId e alunoUid são obrigatórios." }, { status: 400 });
  }

  const db = getAdminDb();
  const turmaSnap = await db.doc(`turmas/${turmaId}`).get();
  const turma = turmaSnap.data();
  if (!turma) {
    return NextResponse.json({ erro: "Turma não encontrada." }, { status: 404 });
  }
  if (turma.orientadorUid !== chamadorUid) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const alunoSnap = await db.doc(`usuarios/${alunoUid}`).get();
  const aluno = alunoSnap.data();
  if (!aluno?.email) {
    return NextResponse.json({ ok: true });
  }

  await enviarEmail({
    to: aluno.email,
    subject: `Convite pra turma do Projeto Integrador — ${turma.nome}`,
    html: modeloEmail(
      `<p><strong>${turma.orientadorNome}</strong> te convidou pra turma <strong>"${turma.nome}"</strong> do Projeto Integrador.</p>
       <p>Entre no SIGMA pra aceitar ou recusar o convite.</p>`,
      { texto: "Ver convite", href: `${URL_SISTEMA}/aluno/projeto-integrador` },
      aluno.nome,
    ),
  });

  return NextResponse.json({ ok: true });
}
