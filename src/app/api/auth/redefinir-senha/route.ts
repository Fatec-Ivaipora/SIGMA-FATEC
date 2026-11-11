import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

/** Confere se o token de /api/auth/recuperar-senha ainda vale — chamado
 * quando /redefinir-senha carrega, antes de mostrar o formulário de senha
 * nova (2026-11-11, ver comentário completo em recuperar-senha/route.ts
 * sobre por que esse token é nosso, não mais o oobCode do Firebase). */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ erro: "Link inválido." }, { status: 400 });
  }

  const db = getAdminDb();
  const snap = await db.doc(`redefinicoesSenha/${token}`).get();
  const pedido = snap.data();
  if (!pedido) {
    return NextResponse.json({ erro: "Esse link de recuperação não é mais válido." }, { status: 404 });
  }
  if (pedido.usadoEm) {
    return NextResponse.json({ erro: "Esse link já foi usado." }, { status: 410 });
  }
  if (pedido.expiraEm.toDate() < new Date()) {
    return NextResponse.json({ erro: "Esse link expirou." }, { status: 410 });
  }

  return NextResponse.json({ email: pedido.email as string });
}

/** Troca a senha de verdade — só aqui o Admin SDK toca o Firebase Auth
 * (ver GET acima pra validar o token antes de mostrar o formulário). Ao
 * confirmar, invalida também qualquer outro pedido de redefinição ainda
 * pendente da mesma conta — sem isso, um link antigo esquecido na caixa de
 * entrada continuaria valendo depois da senha já ter sido trocada por
 * outro link mais recente. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { token?: string; novaSenha?: string }
    | null;
  const token = body?.token;
  const novaSenha = body?.novaSenha;
  if (!token || !novaSenha) {
    return NextResponse.json({ erro: "Token e nova senha são obrigatórios." }, { status: 400 });
  }
  if (novaSenha.length < 6) {
    return NextResponse.json({ erro: "A senha precisa ter pelo menos 6 caracteres." }, { status: 400 });
  }

  const db = getAdminDb();
  const ref = db.doc(`redefinicoesSenha/${token}`);
  const snap = await ref.get();
  const pedido = snap.data();
  if (!pedido) {
    return NextResponse.json({ erro: "Esse link de recuperação não é mais válido." }, { status: 404 });
  }
  if (pedido.usadoEm) {
    return NextResponse.json({ erro: "Esse link já foi usado." }, { status: 410 });
  }
  if (pedido.expiraEm.toDate() < new Date()) {
    return NextResponse.json({ erro: "Esse link expirou." }, { status: 410 });
  }

  try {
    await getAdminAuth().updateUser(pedido.uid as string, { password: novaSenha });
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    const mensagem =
      codigo === "auth/weak-password"
        ? "A senha precisa ter pelo menos 6 caracteres."
        : "Não foi possível salvar a nova senha. Tente novamente.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }

  const agora = new Date();
  const outrosPendentes = await db
    .collection("redefinicoesSenha")
    .where("uid", "==", pedido.uid)
    .where("usadoEm", "==", null)
    .get();
  const batch = db.batch();
  for (const doc of outrosPendentes.docs) {
    batch.update(doc.ref, { usadoEm: agora });
  }
  await batch.commit();

  return NextResponse.json({ ok: true });
}
