import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";
import { ROTA_POR_PAPEL } from "@/lib/auth";

const LABEL_PAPEL: Record<string, string> = {
  avaliador: "avaliador(a)",
  orientador: "orientador(a)",
  moderador: "moderador(a)",
};

/** Avisa quem JÁ TEM CONTA que ganhou mais um papel de avaliação (2026-09-11)
 * — ex.: já era avaliador, o admin marcou "também atua como moderador" em
 * /usuarios. Só admin/organização chama (mesma permissão de quem edita
 * usuário); o papel em si nunca é confiado do client além de validar que é
 * um dos três combináveis — quem realmente ganhou o papel é o próprio doc
 * em usuarios/{uid}, já gravado antes dessa chamada (ver
 * atualizarPapeisAvaliacaoUsuario em src/lib/data/usuarios.ts). */
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

  const db = getAdminDb();
  const chamador = (await db.doc(`usuarios/${chamadorUid}`).get()).data();
  if (chamador?.papel !== "admin" && chamador?.papel !== "organizacao") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const { uid, papel } = (await request.json()) as {
    uid?: string;
    papel?: string;
  };
  if (!uid || !papel || !(papel in LABEL_PAPEL)) {
    return NextResponse.json({ erro: "uid e papel (válido) são obrigatórios." }, { status: 400 });
  }

  const pessoaSnap = await db.doc(`usuarios/${uid}`).get();
  const pessoa = pessoaSnap.data();
  if (!pessoa?.email) {
    return NextResponse.json({ ok: true });
  }

  const label = LABEL_PAPEL[papel];
  await enviarEmail({
    to: pessoa.email,
    subject: `Você agora também é ${label} no SIGMA`,
    html: modeloEmail(
      `<p>A coordenação te adicionou como <strong>${label}</strong> no SIGMA — além do que você já era, você também pode atuar nesse papel agora.</p>`,
      { texto: "Entrar no SIGMA", href: `${URL_SISTEMA}${ROTA_POR_PAPEL[papel as "avaliador" | "orientador" | "moderador"]}` },
      pessoa.nome,
    ),
  });

  return NextResponse.json({ ok: true });
}
