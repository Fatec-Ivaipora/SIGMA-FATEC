import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import { buscarNomes } from "@/lib/buscaProfessor";

/** Sugestão de nome de professor pro orientador/coorientador (2026-10-27,
 * pedido explícito do usuário — "o aluno digita pelo menos 3 letras e você
 * mostra o nome pra ele selecionar"; muitos orientadores são professores da
 * Fatec e o nome saía escrito de jeitos diferentes no certificado).
 *
 * A lista vem do Edubox pelo relay (rota /professores-nomes — só NOMES dos
 * professores com turma em semestre ativo, nada de e-mail/CPF) e fica em
 * memória por algumas horas, pra não consultar o Edubox a cada letra. A
 * lista inteira nunca vai pro navegador: o aluno manda o que digitou e
 * recebe no máximo alguns nomes (regra em src/lib/buscaProfessor.ts). Se o
 * relay estiver fora ou sem a rota, devolve lista vazia — o campo continua
 * aceitando o nome digitado livremente. */

const VALIDADE_MS = 6 * 60 * 60 * 1000;

let cache: { nomes: string[]; carregadoEm: number } | null = null;

async function carregarNomes(): Promise<string[]> {
  if (cache && Date.now() - cache.carregadoEm < VALIDADE_MS) return cache.nomes;
  const relayUrl = process.env.EDUBOX_RELAY_URL;
  const relayToken = process.env.EDUBOX_RELAY_TOKEN;
  if (!relayUrl || !relayToken) return [];
  try {
    const res = await fetch(`${relayUrl}/professores-nomes`, {
      headers: { Authorization: `Bearer ${relayToken}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return cache?.nomes ?? [];
    const corpo = (await res.json()) as { ok?: boolean; nomes?: string[] };
    const nomes = (corpo.nomes ?? [])
      .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
      .map((n) => n.trim());
    cache = { nomes, carregadoEm: Date.now() };
    return nomes;
  } catch {
    // Relay fora do ar: usa a última lista boa, se tiver.
    return cache?.nomes ?? [];
  }
}

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

  const digitado = new URL(request.url).searchParams.get("q") ?? "";
  // A regra de mínimo de letras também está em buscarNomes; aqui só evita
  // consultar o relay à toa.
  if (digitado.trim().length < 3) return NextResponse.json({ nomes: [] });
  return NextResponse.json({ nomes: buscarNomes(await carregarNomes(), digitado) });
}
