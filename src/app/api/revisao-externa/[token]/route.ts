import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { tituloExibicao } from "@/lib/tituloTrabalho";

// ⚠ EXCEÇÃO TEMPORÁRIA — ver comentário em
// src/app/api/revisao-externa/convidar/route.ts. Remover junto com o
// resto da feature depois que os 46 legados da X MAC forem reavaliados.

/** Lista os trabalhos de um convite de reavaliação externa — rota
 * PÚBLICA de propósito (2026-11-06, pedido explícito do usuário —
 * "não precisa de login e nem nada"). O token em si (gerado aleatório em
 * /convidar) É a autorização; não existe usuário Firebase nenhum aqui.
 * Às cegas igual o avaliador interno — nunca devolve nome de aluno. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const db = getAdminDb();
  const conviteSnap = await db.doc(`convitesRevisaoExterna/${token}`).get();
  const convite = conviteSnap.data();
  if (!convite) {
    return NextResponse.json({ erro: "Link inválido ou expirado." }, { status: 404 });
  }

  const trabalhoIds = (convite.trabalhoIds as string[]) ?? [];
  const avaliados = new Set((convite.trabalhosAvaliados as string[]) ?? []);
  const trabalhosSnaps = trabalhoIds.length
    ? await db.getAll(...trabalhoIds.map((id) => db.doc(`trabalhos/${id}`)))
    : [];

  const eventoSnap = await db.doc(`eventos/${convite.eventoId}`).get();

  const trabalhos = trabalhosSnaps
    .filter((s) => s.exists)
    .map((s) => {
      const t = s.data()!;
      return {
        id: s.id,
        titulo: tituloExibicao(t.titulo as string),
        resumo: (t.resumo as string | undefined) ?? "",
        palavrasChave: (t.palavrasChave as string | undefined) ?? "",
        areaTematica: t.areaTematica as string,
        avaliado: avaliados.has(s.id),
      };
    });

  return NextResponse.json({
    nome: convite.nome ?? null,
    eventoNome: eventoSnap.data()?.nome ?? "",
    trabalhos,
  });
}
