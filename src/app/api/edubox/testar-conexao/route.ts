import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

/** Testa a conexão com o Postgres do Edubox (terceiros, fora do nosso controle)
 * — através do relay num VPS de IP fixo (2026-09-02), já que o Vercel usa IP
 * dinâmico e o Edubox só aceita conexão de IP autorizado pelo Cleverson. Essa
 * rota só repassa a chamada pro relay (EDUBOX_RELAY_URL) com o token
 * (EDUBOX_RELAY_TOKEN) — quem de fato conecta no Postgres é o relay, ver
 * infra/edubox-relay/server.mjs no VPS. */
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
      { erro: "Só o Admin pode testar a conexão com o Edubox." },
      { status: 403 },
    );
  }

  const relayUrl = process.env.EDUBOX_RELAY_URL;
  const relayToken = process.env.EDUBOX_RELAY_TOKEN;
  if (!relayUrl || !relayToken) {
    return NextResponse.json(
      { ok: false, erro: "EDUBOX_RELAY_URL / EDUBOX_RELAY_TOKEN ausentes em .env.local / Vercel." },
      { status: 500 },
    );
  }

  try {
    const resposta = await fetch(`${relayUrl}/testar-conexao`, {
      method: "POST",
      headers: { Authorization: `Bearer ${relayToken}` },
      signal: AbortSignal.timeout(15000),
    });
    const corpo = await resposta.json();
    return NextResponse.json(corpo, { status: resposta.status });
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : String(erro);
    return NextResponse.json({
      ok: false,
      mensagem: `Não foi possível falar com o relay: ${msg}`,
      explicacao:
        "O relay (VPS de IP fixo) pode estar fora do ar, ou EDUBOX_RELAY_URL apontando pro endereço errado — confirme se o serviço edubox-relay está rodando no servidor.",
    });
  }
}
