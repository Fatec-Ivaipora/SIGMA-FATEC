import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { GradeBancaPDF, type GrupoBancaParaPdf } from "@/lib/gradeBancaPdf";
import { tituloExibicao } from "@/lib/tituloTrabalho";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function somarMinutos(horario: string, minutos: number): string {
  const [h, m] = horario.split(":").map(Number);
  const total = h * 60 + m + minutos;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** PDF da banca de TCC, uma página por SALA+DIA (2026-11-24, pedido
 * explícito do usuário — primeiro "agrupado por sala, não separado por
 * dias", depois "pode ser por sala e dia, cada folha uma sala e dia").
 * Mesmo padrão de autenticação/autorização de /api/ensalamento/pdf (MAC);
 * só lê `trabalhos` desse evento com `bancaSala`/`bancaHorarioIndex` já
 * definidos (vêm de montarBancaAutomatica — ajuste manual limpa os dois,
 * ver moverBanca em src/lib/data/bancas.ts, então esses trabalhos não
 * entram aqui). */
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
    const comSala = trabalhosSnap.docs
      .map((d) => d.data())
      .filter((t) => t.bancaSala != null && t.bancaHorarioIndex != null && t.bancaData);

    if (comSala.length === 0) {
      return NextResponse.json(
        { erro: "Nenhuma banca com sala definida ainda — gere a banca automaticamente primeiro." },
        { status: 404 },
      );
    }

    const horarioInicio = evento.horarioInicioBanca as string | undefined;
    const duracaoMin = evento.duracaoBancaMinutos as number | undefined;

    function formatarHorario(horarioIndex: number): string {
      if (horarioInicio && duracaoMin) {
        const ini = somarMinutos(horarioInicio, horarioIndex * duracaoMin);
        const fim = somarMinutos(horarioInicio, (horarioIndex + 1) * duracaoMin);
        return `${ini}–${fim}`;
      }
      return `Horário ${horarioIndex + 1}`;
    }

    function formatarDia(data: string): string {
      return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
      });
    }

    // 1 grupo = 1 sala + 1 dia = 1 página (2026-11-24, pedido explícito do
    // usuário — "cada folha uma sala e dia"). Ordenado por sala, depois por
    // dia dentro da sala.
    const porSalaDia = new Map<string, typeof comSala>();
    for (const t of comSala) {
      const chave = `${t.bancaSala}#${t.bancaData}`;
      const lista = porSalaDia.get(chave) ?? [];
      lista.push(t);
      porSalaDia.set(chave, lista);
    }

    const grupos: GrupoBancaParaPdf[] = Array.from(porSalaDia.entries())
      .map(([chave, itens]) => {
        const [salaStr, data] = chave.split("#");
        return { sala: Number(salaStr), data, itens };
      })
      .sort((a, b) => a.sala - b.sala || a.data.localeCompare(b.data))
      .map(({ sala, data, itens }) => ({
        salaNome: String(sala),
        diaLabel: formatarDia(data),
        itens: itens
          .sort((a, b) => (a.bancaHorarioIndex as number) - (b.bancaHorarioIndex as number))
          .map((t) => {
            const avaliadores = (t.bancaAvaliadores as { nome: string }[] | undefined) ?? [];
            return {
              horario: formatarHorario(t.bancaHorarioIndex as number),
              alunoNome: (t.alunoNome as string) ?? "—",
              titulo: tituloExibicao((t.titulo as string) ?? ""),
              nomeOrientador: (t.nomeOrientador as string) ?? "",
              avaliador1: avaliadores[0]?.nome ?? "",
              avaliador2: avaliadores[1]?.nome ?? "",
            };
          }),
      }));

    const geradoEm = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const buffer = await renderToBuffer(
      GradeBancaPDF({
        eventoNome: (evento.nome as string).toLocaleUpperCase("pt-BR"),
        geradoEm,
        grupos,
      }),
    );
    const nomeArquivo = `banca-tcc-${slug(evento.nome as string)}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e) {
    console.error("Erro ao gerar PDF da banca de TCC:", e);
    return NextResponse.json({ erro: "Erro interno ao gerar o PDF." }, { status: 500 });
  }
}
