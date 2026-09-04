import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";

/** E-mail de "você recebeu trabalhos novos" pra avaliador/moderador —
 * chamado pela organização/admin logo depois da distribuição em lote (ver
 * src/app/trabalhos/page.tsx). Um e-mail por pessoa, com a quantidade
 * recebida — não um por trabalho, pra não inundar a caixa de entrada numa
 * distribuição grande. */
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
  const chamadorSnap = await db.doc(`usuarios/${chamadorUid}`).get();
  const chamador = chamadorSnap.data();
  if (chamador?.papel !== "admin" && chamador?.papel !== "organizacao") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const { destinatarios } = (await request.json()) as {
    destinatarios?: { uid: string; papel: "avaliador" | "moderador"; quantidade: number }[];
  };
  if (!destinatarios || destinatarios.length === 0) {
    return NextResponse.json({ erro: "destinatarios é obrigatório." }, { status: 400 });
  }

  await Promise.all(
    destinatarios.map(async ({ uid, papel, quantidade }) => {
      const snap = await db.doc(`usuarios/${uid}`).get();
      const pessoa = snap.data();
      if (!pessoa?.email) return;

      const acao = papel === "avaliador" ? "avaliar" : "apresentação/avaliar";
      const rota = papel === "avaliador" ? "avaliacao" : "apresentacao";
      await enviarEmail({
        to: pessoa.email,
        subject: `${quantidade} trabalho${quantidade === 1 ? "" : "s"} novo${quantidade === 1 ? "" : "s"} pra você`,
        html: modeloEmail(
          `<p>Você recebeu <strong>${quantidade} trabalho${quantidade === 1 ? "" : "s"}</strong> novo${
            quantidade === 1 ? "" : "s"
          } pra ${acao} no SIGMA.</p>`,
          { texto: "Ver trabalhos", href: `${URL_SISTEMA}/avaliador/trabalhos?aba=${rota}` },
        ),
      });
    }),
  );

  return NextResponse.json({ ok: true });
}
