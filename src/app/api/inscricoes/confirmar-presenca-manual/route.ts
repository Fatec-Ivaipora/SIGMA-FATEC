import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { diasDoEvento } from "@/lib/certificadoDias";

/** Marca/desmarca presença manualmente, sem QR (2026-09-30) — pedido
 * explícito do usuário: às vezes a pessoa não consegue escanear (câmera com
 * problema, celular sem internet no local, etc), e precisa de um jeito de
 * dar presença na mão. Só admin/organização do evento — DE PROPÓSITO sem
 * monitor aqui, mesmo que ele já tenha acesso à tela do QR: dar esse poder
 * pro monitor anularia a auditoria por dia que existe bem pra desconfiar de
 * monitor marcando presença falsa pra um amigo (ver ConfirmacaoPresencaView
 * em src/app/ensalamento/page.tsx). inscricoesEvento é allow write: if
 * false pro client — só rotas com Admin SDK gravam presencasConfirmadas. */
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

  const body = (await request.json().catch(() => null)) as {
    eventoId?: string;
    uid?: string;
    dia?: number;
    confirmar?: boolean;
  } | null;
  const { eventoId, uid, dia, confirmar } = body ?? {};
  if (!eventoId || !uid || !Number.isInteger(dia) || typeof confirmar !== "boolean") {
    return NextResponse.json(
      { erro: "eventoId, uid, dia e confirmar são obrigatórios." },
      { status: 400 },
    );
  }

  const db = getAdminDb();
  const [chamadorSnap, eventoSnap] = await Promise.all([
    db.doc(`usuarios/${chamadorUid}`).get(),
    db.doc(`eventos/${eventoId}`).get(),
  ]);
  const chamador = chamadorSnap.data();
  const evento = eventoSnap.data();
  if (!evento) {
    return NextResponse.json({ erro: "Evento não encontrado." }, { status: 404 });
  }
  if (evento.tipo !== "simples") {
    return NextResponse.json(
      { erro: "Esse evento não usa confirmação de presença por QR." },
      { status: 400 },
    );
  }

  const ehStaff =
    chamador?.papel === "admin" ||
    (chamador?.papel === "organizacao" &&
      (chamador?.eventosPermitidos ?? []).includes(eventoId));
  if (!ehStaff) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const diasEvento = diasDoEvento(evento);
  if (dia! < 1 || dia! > diasEvento) {
    return NextResponse.json({ erro: "Dia inválido pra esse evento." }, { status: 400 });
  }

  const inscricaoRef = db.doc(`inscricoesEvento/${eventoId}::${uid}`);
  if (!(await inscricaoRef.get()).exists) {
    return NextResponse.json(
      { erro: "Essa pessoa não está inscrita nesse evento." },
      { status: 400 },
    );
  }

  const chaveDia = `presencasConfirmadas.${dia}`;
  await inscricaoRef.update({
    [chaveDia]: confirmar ? FieldValue.serverTimestamp() : FieldValue.delete(),
  });

  return NextResponse.json({ ok: true });
}
