import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

/** Lista de orientadores pro aluno escolher na inscrição de TCC (2026-11-16,
 * pedido explícito do usuário — orientador vira um usuário real do sistema,
 * não texto livre como `nomeOrientador` na MAC, porque ele entra na banca e
 * precisa de disponibilidade). Servidor porque firestore.rules não deixa um
 * aluno ler o doc `usuarios/{uid}` de ninguém além de si mesmo (corrigido no
 * pentest de 2026-09-08) — teria que existir um espelho público novo só pra
 * isso, e essa rota evita criar mais uma coleção espelho. Devolve só
 * uid+nome, nunca o doc inteiro (sem cpf/dataNascimento/email).
 *
 * Só orientadores ATRIBUÍDOS a esse evento (atribuicoesEventos.eventoId ===
 * eventoId, ver AtribuicaoEvento em auth.tsx) — mesmo mecanismo já usado pra
 * avaliador/moderador em /usuarios, sem precisar de nada novo lá. Admin
 * precisa atribuir o orientador ao evento TCC antes do aluno conseguir
 * escolhê-lo aqui. */
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

  const eventoId = new URL(request.url).searchParams.get("eventoId");
  if (!eventoId) {
    return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
  }

  const db = getAdminDb();
  // Dois queries separados (não um OR só) — mesmo motivo de useTrabalhos em
  // trabalhos.ts: papel primário e papeisAvaliacao são campos diferentes.
  const [porPapel, porPapeisAvaliacao] = await Promise.all([
    db.collection("usuarios").where("papel", "==", "orientador").get(),
    db.collection("usuarios").where("papeisAvaliacao", "array-contains", "orientador").get(),
  ]);

  const porUid = new Map<string, { uid: string; nome: string }>();
  for (const doc of [...porPapel.docs, ...porPapeisAvaliacao.docs]) {
    const dados = doc.data();
    const atribuido = (
      (dados.atribuicoesEventos ?? []) as { eventoId: string }[]
    ).some((a) => a.eventoId === eventoId);
    if (atribuido) porUid.set(doc.id, { uid: doc.id, nome: dados.nome as string });
  }

  const orientadores = Array.from(porUid.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
  return NextResponse.json({ orientadores });
}
