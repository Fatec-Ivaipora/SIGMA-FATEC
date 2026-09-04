import { NextResponse } from "next/server";

/** Verifica um R.A. contra o Edubox comparando com o nome digitado no
 * cadastro — usado no autocadastro do aluno (2026-09-04), ANTES de existir
 * uma conta (por isso essa rota não exige Bearer idToken, diferente das
 * outras rotas de /api/edubox/*). Motivo: um funcionário já se cadastrou
 * como aluno usando o R.A. de outra pessoa (ver rasCadastrados/
 * firestore.rules) — obrigatório passar por aqui antes de criar a conta
 * (ver src/app/cadastro/aluno/page.tsx). NUNCA devolve o nome de verdade
 * vinculado ao RA no Edubox (pedido explícito, 2026-09-04: não expor nome
 * de outra pessoa caso o RA não seja de quem está se cadastrando) — só se
 * bate ou não, a comparação em si acontece no relay. Só repassa pro relay
 * (EDUBOX_RELAY_URL), que é quem de fato consulta o Postgres do Edubox —
 * SELECT only, nenhum risco de escrita. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ra = (url.searchParams.get("ra") ?? "").trim();
  const nome = (url.searchParams.get("nome") ?? "").trim();

  if (!/^\d{10}$/.test(ra)) {
    return NextResponse.json({ erro: "RA precisa ter 10 dígitos." }, { status: 400 });
  }
  if (!nome) {
    return NextResponse.json({ erro: "Preencha o nome completo antes de verificar." }, { status: 400 });
  }

  const relayUrl = process.env.EDUBOX_RELAY_URL;
  const relayToken = process.env.EDUBOX_RELAY_TOKEN;
  if (!relayUrl || !relayToken) {
    return NextResponse.json(
      { erro: "EDUBOX_RELAY_URL / EDUBOX_RELAY_TOKEN ausentes em .env.local / Vercel." },
      { status: 500 },
    );
  }

  try {
    const resposta = await fetch(
      `${relayUrl}/verificar-ra?ra=${encodeURIComponent(ra)}&nome=${encodeURIComponent(nome)}`,
      {
        headers: { Authorization: `Bearer ${relayToken}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    const corpo = await resposta.json();
    if (!resposta.ok || !corpo.ok) {
      return NextResponse.json(
        { erro: corpo.erro ?? "Não foi possível verificar o RA agora. Tente de novo." },
        { status: 502 },
      );
    }
    return NextResponse.json({ encontrado: corpo.encontrado, compativel: corpo.compativel });
  } catch {
    return NextResponse.json(
      { erro: "Não foi possível verificar o RA agora. Tente de novo." },
      { status: 502 },
    );
  }
}
