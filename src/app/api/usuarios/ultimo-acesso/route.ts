import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

// Tela Usuários (2026-11-27, pedido explícito do usuário — "coloque na
// frente dos cargos o último acesso do usuário, tanto para avaliador,
// moderador, orientador, tudo") — último acesso vem do PRÓPRIO Firebase
// Auth (metadata.lastSignInTime), não precisa de nenhum campo novo no
// Firestore nem de gravar nada a cada login; só o admin/organização pode
// consultar (dado de outra conta, não dá pra ler do client). `getUsers`
// busca em lote (até 100 por vez, por isso o client manda em pedaços) —
// bem mais barato que 1 chamada por uid.
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

  try {
    const chamadorDoc = await getAdminDb().doc(`usuarios/${chamadorUid}`).get();
    const chamador = chamadorDoc.data();
    const souAdmin = chamador?.papel === "admin";
    const souOrganizacao = chamador?.papel === "organizacao";
    if (!souAdmin && !souOrganizacao) {
      return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as { uids?: string[] } | null;
    const uids = (body?.uids ?? []).filter((uid): uid is string => typeof uid === "string" && uid.length > 0);
    if (uids.length === 0) {
      return NextResponse.json({ erro: "uids é obrigatório." }, { status: 400 });
    }
    if (uids.length > 100) {
      return NextResponse.json({ erro: "No máximo 100 uids por chamada." }, { status: 400 });
    }

    const auth = getAdminAuth();
    const resultado = await auth.getUsers(uids.map((uid) => ({ uid })));

    const ultimoAcesso: Record<string, string | null> = {};
    for (const u of resultado.users) {
      ultimoAcesso[u.uid] = u.metadata.lastSignInTime ?? null;
    }
    // Conta existe no Firestore mas não no Auth (achado real comum — conta
    // órfã, ou excluída direto no console) — não deixa o uid faltando no
    // retorno, melhor dizer explicitamente "nunca acessou".
    for (const naoEncontrado of resultado.notFound) {
      if ("uid" in naoEncontrado && naoEncontrado.uid) ultimoAcesso[naoEncontrado.uid] = null;
    }

    return NextResponse.json({ ultimoAcesso });
  } catch (e) {
    console.error("Erro ao buscar último acesso:", e);
    return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
  }
}
