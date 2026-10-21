import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { ListaPresencaPDF } from "@/lib/certificadosPdf";
import { periodosDoEvento, rotuloPeriodo } from "@/lib/periodosPresenca";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Lista de presença de UM período em PDF (2026-10-21, pedido explícito do
 * usuário — "lista de presença por período, disponível pra baixar"). Só
 * admin/organização do evento (lista nominal com curso e horário — não é
 * pra monitor, diferente da rota-irmã ../route.ts que só alimenta a tela de
 * check-in). Funciona com o evento encerrado (é justamente quando mais se
 * precisa dela, junto da Ata — ver botão em /eventos). Fonte: as mesmas
 * `presencasConfirmadas` do QR/presença manual, chave = número do período. */
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
    const periodo = Number(url.searchParams.get("periodo"));
    if (!eventoId || !Number.isInteger(periodo) || periodo < 1) {
      return NextResponse.json({ erro: "eventoId e periodo são obrigatórios." }, { status: 400 });
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
    if (periodo > periodosDoEvento(evento)) {
      return NextResponse.json({ erro: "Período inválido pra esse evento." }, { status: 400 });
    }

    const inscritosSnap = await db
      .collection("inscricoesEvento")
      .where("eventoId", "==", eventoId)
      .get();
    const presentesInsc = inscritosSnap.docs
      .map((d) => d.data())
      .filter((i) => !!i.presencasConfirmadas?.[String(periodo)]);

    // Curso vem do perfil (usuarios), não da inscrição — getAll numa leva só.
    const perfis = presentesInsc.length
      ? await db.getAll(...presentesInsc.map((i) => db.doc(`usuarios/${i.uid}`)))
      : [];
    const cursoPorUid = new Map(perfis.map((p) => [p.id, (p.data()?.curso as string) ?? ""]));

    const presentes = presentesInsc
      .map((i) => {
        const ts = i.presencasConfirmadas[String(periodo)];
        const data: Date = typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts);
        return {
          nome: (i.nome as string) ?? "",
          curso: cursoPorUid.get(i.uid as string) ?? "",
          horario: isNaN(data.getTime())
            ? ""
            : data.toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }),
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const periodoRotulo = rotuloPeriodo(evento, periodo);
    const buffer = await renderToBuffer(
      ListaPresencaPDF({
        eventoNome: evento.nome as string,
        periodoRotulo,
        dataRealizacao: (evento.dataRealizacao as string) || undefined,
        dataRealizacaoFim: (evento.dataRealizacaoFim as string) || undefined,
        presentes,
        totalInscritos: inscritosSnap.size,
      }),
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="lista-presenca-${slug(periodoRotulo)}-${slug(evento.nome as string)}.pdf"`,
      },
    });
  } catch (e) {
    console.error("Erro ao gerar lista de presença:", e);
    return NextResponse.json({ erro: "Erro interno ao gerar a lista de presença." }, { status: 500 });
  }
}
