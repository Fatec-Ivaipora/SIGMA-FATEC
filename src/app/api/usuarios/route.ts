import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

type AtribuicaoEvento = { eventoId: string; areasTematicas?: string[] };

type CriarUsuarioBody = {
  nome: string;
  email: string;
  papel: "aluno" | "avaliador" | "organizacao" | "admin" | "orientador" | "moderador";
  atribuicoesEventos?: AtribuicaoEvento[];
  // Papéis combináveis (2026-08-26) — ver PAPEIS_AVALIACAO em src/lib/auth.tsx.
  papeisAvaliacao?: ("avaliador" | "orientador" | "moderador")[];
};

function senhaTemporaria(): string {
  return randomBytes(9).toString("base64url");
}

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

  const chamadorDoc = await getAdminDb().doc(`usuarios/${chamadorUid}`).get();
  if (chamadorDoc.data()?.papel !== "admin") {
    return NextResponse.json(
      { erro: "Só o Admin pode criar novos usuários." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as CriarUsuarioBody;
  if (!body.nome?.trim() || !body.email?.trim() || !body.papel) {
    return NextResponse.json({ erro: "Nome, e-mail e papel são obrigatórios." }, {
      status: 400,
    });
  }

  const senha = senhaTemporaria();

  let uid: string;
  try {
    const contaCriada = await getAdminAuth().createUser({
      email: body.email.trim(),
      password: senha,
      displayName: body.nome.trim(),
    });
    uid = contaCriada.uid;
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    const mensagem =
      codigo === "auth/email-already-exists"
        ? "Já existe uma conta com esse e-mail."
        : "Não foi possível criar a conta no Authentication.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }

  await getAdminDb()
    .doc(`usuarios/${uid}`)
    .set({
      nome: body.nome.trim(),
      email: body.email.trim(),
      papel: body.papel,
      ...(body.atribuicoesEventos && body.atribuicoesEventos.length > 0
        ? {
            atribuicoesEventos: body.atribuicoesEventos,
            eventosPermitidos: body.atribuicoesEventos.map((a) => a.eventoId),
          }
        : {}),
      ...(body.papeisAvaliacao && body.papeisAvaliacao.length > 0
        ? { papeisAvaliacao: body.papeisAvaliacao }
        : {}),
      // Conta criada pelo admin com senha gerada na hora (nunca escolhida pela
      // pessoa) — força trocar no primeiro login via SenhaTemporariaGate,
      // senão a pessoa loga uma vez, nunca troca, e esquece a senha depois
      // (nunca foi dela pra começo de conversa).
      senhaTemporaria: true,
    });

  return NextResponse.json({ uid, senhaTemporaria: senha });
}

export async function DELETE(request: Request) {
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

  const chamadorDoc = await getAdminDb().doc(`usuarios/${chamadorUid}`).get();
  if (chamadorDoc.data()?.papel !== "admin") {
    return NextResponse.json(
      { erro: "Só o Admin pode excluir usuários." },
      { status: 403 },
    );
  }

  const { uid } = (await request.json()) as { uid: string };
  if (!uid) {
    return NextResponse.json({ erro: "uid é obrigatório." }, { status: 400 });
  }

  await getAdminAuth().deleteUser(uid);
  await getAdminDb().doc(`usuarios/${uid}`).delete();

  return NextResponse.json({ ok: true });
}
