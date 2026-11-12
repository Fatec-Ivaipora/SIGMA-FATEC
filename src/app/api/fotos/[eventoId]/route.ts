import { NextResponse, after } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { lerIndice, sincronizarGaleria } from "@/lib/galeriaFotos";

export const maxDuration = 60;

/** Galeria pública de fotos do evento (2026-11-12) — sem login. Devolve o
 * nome do evento e as fotos já copiadas para o Storage. Se o evento tem
 * pasta do Drive configurada (`galeriaDriveFolderId`), dispara DEPOIS da
 * resposta a verificação de fotos novas (no máximo a cada 10 min, ver
 * sincronizarGaleria) — "precisa sempre estar atualizado", pedido do
 * usuário: quem adicionar fotos na pasta não precisa fazer mais nada. */
export async function GET(_request: Request, ctx: { params: Promise<{ eventoId: string }> }) {
  const { eventoId } = await ctx.params;
  const eventoSnap = await getAdminDb().doc(`eventos/${eventoId}`).get();
  const evento = eventoSnap.data();
  if (!evento) return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });

  const pastaId = evento.galeriaDriveFolderId as string | undefined;
  const indice = await lerIndice(eventoId);
  if (!pastaId && indice.fotos.length === 0) {
    return NextResponse.json({ erro: "Este evento ainda não tem fotos." }, { status: 404 });
  }

  if (pastaId) {
    after(async () => {
      try {
        await sincronizarGaleria(eventoId, pastaId);
      } catch {
        // pasta inacessível/instável — tenta de novo na próxima visita
      }
    });
  }

  return NextResponse.json(
    {
      eventoNome: evento.nome as string,
      logoEvento: (evento.galeriaLogo as string | undefined) ?? null,
      atualizadoEm: indice.atualizadoEm,
      fotos: indice.fotos.map(({ nome, original, web, mini }) => ({ nome, original, web, mini })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
