import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { PodioPorAreaPDF } from "@/lib/certificadosPdf";
import { analisarEmpatesPorArea, STATUS_JA_AVALIADO } from "@/lib/analiseEmpate";
import type { Trabalho } from "@/lib/data/trabalhos";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** PDF do pódio por área temática (2026-11-11, pedido explícito do usuário
 * — "no final do evento podermos imprimir e levar lá na frente no palco e
 * chamar os premiados de cada área"). Reaproveita `analisarEmpatesPorArea`
 * (a MESMA regra de posição usada na tela de Trabalhos — nunca recalculada
 * diferente aqui), por isso só mostra posição de quem já está
 * SEM AMBIGUIDADE nenhuma (`posicoes`); um grupo ainda em desempate não
 * ganha posição nenhuma e simplesmente não aparece — o admin resolve na
 * aba Desempate antes de gerar esse PDF pro palco. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  try {
    const uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
    const db = getAdminDb();
    const url = new URL(request.url);
    const eventoId = url.searchParams.get("eventoId");
    if (!eventoId) {
      return NextResponse.json({ erro: "eventoId é obrigatório." }, { status: 400 });
    }

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
    if (!ehStaff) {
      return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    }

    const trabalhosSnap = await db.collection("trabalhos").where("eventoId", "==", eventoId).get();
    const trabalhos = trabalhosSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trabalho);

    const pool = trabalhos.filter(
      (t) =>
        STATUS_JA_AVALIADO.includes(t.status) &&
        typeof t.notaAvaliador === "number" &&
        t.compareceuApresentacao !== false,
    );
    const analise = analisarEmpatesPorArea(pool);
    const porId = new Map(trabalhos.map((t) => [t.id, t]));

    const areas = Array.from(analise.entries())
      .map(([, info]) => {
        const colocados = Object.entries(info.posicoes)
          .map(([id, posicao]) => {
            const t = porId.get(id);
            if (!t) return null;
            const autores = [t.alunoNome, ...(t.participantesNomes ?? [])]
              .filter(Boolean)
              .join(", ")
              .toLocaleUpperCase("pt-BR");
            const orientacao = [t.nomeOrientador, ...(t.nomesCoorientadores ?? [])]
              .filter(Boolean)
              .join(", ")
              .toLocaleUpperCase("pt-BR");
            return { posicao, titulo: t.titulo, autores, orientacao, areaTematica: t.areaTematica };
          })
          .filter((c): c is NonNullable<typeof c> => c !== null)
          .sort((a, b) => a.posicao - b.posicao);
        if (colocados.length === 0) return null;
        return { areaTematica: colocados[0].areaTematica, colocados };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null)
      .sort((a, b) => a.areaTematica.localeCompare(b.areaTematica, "pt-BR"));

    if (areas.length === 0) {
      return NextResponse.json(
        { erro: "Nenhuma área com pódio resolvido ainda (sem empate pendente)." },
        { status: 404 },
      );
    }

    const buffer = await renderToBuffer(
      PodioPorAreaPDF({ eventoNome: (evento.nome as string).toLocaleUpperCase("pt-BR"), areas }),
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="podio-${slug(evento.nome as string)}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e) {
    console.error("Erro ao gerar o pódio por área:", e);
    return NextResponse.json({ erro: "Erro interno ao gerar o pódio." }, { status: 500 });
  }
}
