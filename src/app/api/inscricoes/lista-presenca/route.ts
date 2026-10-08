import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

/** Lista de presença de um evento "simples" pra quem tem função de ajudar
 * com isso (2026-09-30) — admin/organização (igual sempre) OU monitor
 * DESSE evento especificamente, e só se o evento for tipo "simples"
 * (monitor de evento completo continua sem nenhum acesso extra no sistema).
 * Rota própria (Admin SDK) porque firestore.rules só libera listar
 * inscricoesEvento inteiro pra admin/organização — um monitor-aluno só
 * pode ler a PRÓPRIA inscrição direto do client, mesmo problema que
 * /api/inscricoes/uids já resolve pro mesmo tipo de caso. Devolve os
 * timestamps de presencasConfirmadas como ISO string (não dá pra mandar um
 * Timestamp do Admin SDK direto num JSON) — quem chama reconstrói um
 * Timestamp do client se precisar (ver EnsalamentoMonitorView). */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  }

  const url = new URL(request.url);
  const eventoId = url.searchParams.get("eventoId");
  if (!eventoId) {
    return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
  }

  const db = getAdminDb();
  const [chamadorSnap, eventoSnap] = await Promise.all([
    db.doc(`usuarios/${uid}`).get(),
    db.doc(`eventos/${eventoId}`).get(),
  ]);
  const chamador = chamadorSnap.data();
  const evento = eventoSnap.data();
  if (!evento) {
    return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
  }

  const ehStaff =
    chamador?.papel === "admin" ||
    (chamador?.papel === "organizacao" && (chamador?.eventosPermitidos ?? []).includes(eventoId));

  let ehMonitor = false;
  if (!ehStaff && evento.tipo === "simples") {
    const monitorSnap = await db.doc(`monitoresEvento/${eventoId}::${uid}`).get();
    ehMonitor = monitorSnap.exists;
  }

  if (!ehStaff && !ehMonitor) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const inscritosSnap = await db
    .collection("inscricoesEvento")
    .where("eventoId", "==", eventoId)
    .get();

  const inscritos = inscritosSnap.docs.map((d) => {
    const dados = d.data();
    const presencasConfirmadasIso: Record<string, string> = {};
    const presencasConfirmadas = dados.presencasConfirmadas as
      | Record<string, FirebaseFirestore.Timestamp>
      | undefined;
    for (const [dia, ts] of Object.entries(presencasConfirmadas ?? {})) {
      presencasConfirmadasIso[dia] = ts.toDate().toISOString();
    }
    return {
      id: d.id,
      eventoId,
      uid: dados.uid as string,
      nome: dados.nome as string,
      email: dados.email as string,
      vinculoFatec: dados.vinculoFatec as boolean,
      valor: dados.valor as number,
      status: dados.status as string,
      presencasConfirmadas: presencasConfirmadasIso,
      // Atribuição (2026-10-08) — plano, sem Timestamp dentro, passa direto.
      presencasConfirmadasPor: dados.presencasConfirmadasPor as
        | Record<string, { nome: string; tipo: "qr" | "manual" }>
        | undefined,
    };
  });

  return NextResponse.json({ inscritos });
}
