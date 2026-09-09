import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { enviarEmail, modeloEmail, URL_SISTEMA } from "@/lib/mail";
import { registrarAtividade } from "@/lib/atividadesAdmin";

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

  const { destinatarios, eventoId } = (await request.json()) as {
    destinatarios?: { uid: string; papel: "avaliador" | "moderador"; quantidade: number }[];
    eventoId?: string | null;
  };
  if (!destinatarios || destinatarios.length === 0) {
    return NextResponse.json({ erro: "destinatarios é obrigatório." }, { status: 400 });
  }

  // Só busca o nome do evento se todo mundo distribuído é do mesmo (ver
  // eventoComumSelecionado em src/app/trabalhos/page.tsx) — feed cai num
  // texto genérico quando a seleção espalha por mais de um evento.
  const eventoNome = eventoId
    ? ((await db.doc(`eventos/${eventoId}`).get()).data()?.nome as string | undefined)
    : undefined;

  await Promise.all(
    destinatarios.map(async ({ uid, papel, quantidade }) => {
      const snap = await db.doc(`usuarios/${uid}`).get();
      const pessoa = snap.data();
      if (!pessoa) return;

      const acao = papel === "avaliador" ? "avaliar" : "apresentação/avaliar";
      const rota = papel === "avaliador" ? "avaliacao" : "apresentacao";
      const plural = quantidade === 1 ? "" : "s";

      // Feed da tela inicial do avaliador/moderador (2026-09-09) — melhor
      // esforço, nunca derruba o e-mail abaixo se falhar.
      try {
        const textoBase = `Você recebeu ${quantidade} trabalho${plural} novo${plural} pra ${acao}`;
        const texto = eventoNome ? `${textoBase} no evento ${eventoNome}.` : `${textoBase}.`;
        await registrarAtividade({
          uid,
          tipo: "atribuicao",
          texto,
          negritos: eventoNome ? [eventoNome] : [],
          eventoId: eventoId ?? undefined,
        });
      } catch {
        // idem
      }

      if (!pessoa.email) return;
      await enviarEmail({
        to: pessoa.email,
        subject: `${quantidade} trabalho${plural} novo${plural} pra você`,
        html: modeloEmail(
          `<p>Você recebeu <strong>${quantidade} trabalho${plural}</strong> novo${plural} pra ${acao} no SIGMA.</p>`,
          { texto: "Ver trabalhos", href: `${URL_SISTEMA}/avaliador/trabalhos?aba=${rota}` },
          pessoa.nome,
        ),
      });
    }),
  );

  return NextResponse.json({ ok: true });
}
