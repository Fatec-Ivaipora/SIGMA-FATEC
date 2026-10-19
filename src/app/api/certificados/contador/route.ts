import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

/** "Em que número ficou" o contador de registro de um evento (2026-10-19,
 * pedido explícito do usuário — precisa saber onde um evento parou pra
 * decidir o `numeroRegistroInicial` do próximo, já que os números seguem
 * em sequência entre eventos diferentes, não por conta própria). Só lê
 * `contadores/certificados_{eventoId}` (ver obterNumeroRegistro em
 * ../route.ts) — nunca incrementa, só mostra. `proximo` ausente = nenhum
 * certificado desse evento foi emitido ainda. `liberando` (2026-10-19) —
 * se `/api/certificados/liberar` ainda está no meio do lote (ver lá) —
 * usado pelo modal da Ata pra avisar antes de deixar gerar pela metade. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  try {
    const uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
    const db = getAdminDb();
    const chamador = (await db.doc(`usuarios/${uid}`).get()).data();

    const { searchParams } = new URL(request.url);
    const eventoId = searchParams.get("eventoId");
    if (!eventoId) {
      return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
    }

    const souAdmin = chamador?.papel === "admin";
    const souOrganizacaoDoEvento =
      chamador?.papel === "organizacao" &&
      (chamador?.eventosPermitidos ?? []).includes(eventoId);
    if (!souAdmin && !souOrganizacaoDoEvento) {
      return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    }

    const [contadorSnap, eventoSnap] = await Promise.all([
      db.doc(`contadores/certificados_${eventoId}`).get(),
      db.doc(`eventos/${eventoId}`).get(),
    ]);
    const proximo = contadorSnap.data()?.proximo as number | undefined;
    // liberando (2026-10-19, pedido explícito do usuário) — pra avisar
    // antes de deixar preencher o formulário da Ata, ver ../liberar/route.ts.
    const liberando = eventoSnap.data()?.liberandoCertificados === true;
    return NextResponse.json({ proximo: proximo ?? null, liberando });
  } catch (e) {
    console.error("Erro ao ler contador de certificados:", e);
    return NextResponse.json({ erro: "Erro interno ao consultar o contador." }, { status: 500 });
  }
}
